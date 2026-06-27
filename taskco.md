# Taskco — Project Plan & Architecture

> Single source of truth for building **Taskco**, a multi-user task manager (Users → Projects → Tasks).
> Keep this file in the repo root and update it as decisions change. Every section below is a contract the codebase should honor.

**Last updated:** 2026-06-27
**Status:** Planning

---

## 1. Overview

Taskco is a full-stack task-management app. A user signs in, owns projects, and each project holds tasks with a status, priority, and optional due date. Auth is JWT-based. Every API response uses a consistent `{ data }` / `{ error }` envelope and every input is validated with Zod.

**Domain hierarchy:** `User 1—* Project 1—* Task`

---

## 2. Tech Stack

| Layer | Choice | Version (June 2026) | Notes |
|---|---|---|---|
| Language | TypeScript | 5.x | `strict: true` everywhere |
| Framework | Next.js (App Router) | 16.2.x | Full-stack: API route handlers + React frontend in one codebase. Turbopack is the default bundler. |
| UI runtime | React | 19.2 | Server + Client Components |
| Styling | Tailwind CSS | v4 | CSS-first config (`@import "tailwindcss"`), no `tailwind.config.js` needed |
| ORM | Prisma | 7.x | `prisma-client` generator + `prisma.config.ts` |
| Database | PostgreSQL | 15+ | Local via Docker; managed in prod |
| Validation | Zod | 4.x | Shared schemas for API + forms |
| Password hashing | bcrypt (or bcryptjs) | latest | `bcryptjs` if you want a pure-JS dependency with no native build |
| Auth | JWT | `jose` (recommended) | `jose` is Edge-compatible; works in route handlers and `proxy.ts` |
| Testing | Vitest + React Testing Library | Vitest 4.x | Optional Playwright for E2E (see §11) |
| Runtime | Node.js | 22 LTS | Next.js 16 requires Node ≥ 20.9 |

### ⚠️ Stack correction: Vite is **not** used
You originally listed both Next.js and Vite. Next.js ships its own bundler (Turbopack), so Vite has no place here. This plan is **Next.js full-stack**. If you ever want a decoupled SPA instead, that becomes "Vite + React frontend" + "standalone Express/Fastify API" — a different architecture from this document.

### A note on `jose` vs `jsonwebtoken`
JWT verification may run in Next.js middleware (`proxy.ts`), which executes on the Edge runtime where Node's `crypto` isn't fully available. `jose` works in both Edge and Node. If you only ever verify tokens inside Node route handlers, `jsonwebtoken` is fine too — but standardizing on `jose` avoids surprises.

---

## 3. Architecture Decisions (the "why")

1. **One Next.js app, two halves.** `app/api/**/route.ts` is the backend; `app/(…)/page.tsx` is the frontend. They share types and Zod schemas — no drift between client and server.
2. **Thin route handlers, fat services.** Route handlers do four things only: parse + validate input, check auth, call a service, shape the response. All business logic and Prisma calls live in `src/server/services/`. This keeps handlers trivial and makes services unit-testable without HTTP.
3. **One Prisma client instance.** A singleton in `src/lib/db.ts` prevents connection exhaustion during dev hot-reload.
4. **Validation at the boundary.** Nothing untrusted reaches a service without passing a Zod schema first.
5. **Uniform envelope.** Success and failure always have the same shape (§6), so the frontend has exactly one way to read every response.
6. **Ownership is enforced server-side, always.** Every project/task query is scoped by the authenticated user's id. A user can never read or mutate another user's data, even with a guessed id.

---

## 4. Data Model (Prisma)

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"      // Prisma 7 generator (Rust-free, WASM query compiler)
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  createdAt    DateTime  @default(now())
  projects     Project[]
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  color       String   @default("#3b82f6")
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  tasks       Task[]
  createdAt   DateTime @default(now())

  @@index([ownerId])
}

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  dueDate     DateTime?
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([projectId])
  @@index([status])
  @@index([priority])
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
}
```

**Cascade behavior**
- Deleting a **User** → deletes their Projects → deletes those Projects' Tasks.
- Deleting a **Project** → deletes its Tasks. (This satisfies "DELETE /projects/:id cascades to tasks".)

**Indexes** are added on every foreign key and on the Task columns you filter by (`status`, `priority`) so list endpoints stay fast.

**Prisma 7 setup files**
- `prisma.config.ts` at the repo root holds config (created automatically by recent Prisma CLI).
- The client is imported from the generated output path, re-exported through `src/lib/db.ts`.

---

## 5. API Surface

All endpoints live under `/api`. All responses use the envelope in §6. All bodies/queries are Zod-validated.

| Method | Endpoint | Auth | Purpose |
|---|---|:---:|---|
| POST | `/api/auth/register` | — | Create user, return JWT |
| POST | `/api/auth/login` | — | Verify credentials, return JWT |
| GET | `/api/auth/me` | ✅ | Return current user |
| GET | `/api/projects` | ✅ | List current user's projects |
| POST | `/api/projects` | ✅ | Create project |
| GET | `/api/projects/:id` | ✅ | Get one project (with task count) |
| PATCH | `/api/projects/:id` | ✅ | Update project |
| DELETE | `/api/projects/:id` | ✅ | Delete project (cascades to tasks) |
| GET | `/api/projects/:id/tasks` | ✅ | List tasks (filter by `status`, `priority`) |
| POST | `/api/projects/:id/tasks` | ✅ | Create task |
| PATCH | `/api/tasks/:id` | ✅ | Update task |
| DELETE | `/api/tasks/:id` | ✅ | Delete task |

**Route handler conventions**
- In Next.js 16, dynamic params are async: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`.
- Filters on `GET /projects/:id/tasks` come from the query string: `?status=TODO&priority=HIGH`. Validate them with a Zod schema that allows the enum values or `undefined`.
- `GET /projects/:id` returns the project plus a `taskCount` (via Prisma `_count`).

### Zod schemas (shape, not full code)

`src/lib/validations/auth.schema.ts`
- `registerSchema` → `{ email: string().email(), password: string().min(8), name: string().min(1) }`
- `loginSchema` → `{ email, password }`

`src/lib/validations/project.schema.ts`
- `createProjectSchema` → `{ name: string().min(1), description?: string, color?: string().regex(hex) }`
- `updateProjectSchema` → all fields optional (`.partial()`)

`src/lib/validations/task.schema.ts`
- `createTaskSchema` → `{ title: string().min(1), description?, status?, priority?, dueDate?: coerce.date() }`
- `updateTaskSchema` → `.partial()`
- `taskFilterSchema` → `{ status?: TaskStatus, priority?: Priority }`

> Derive shared TS types from schemas with `z.infer<typeof schema>` so the frontend forms and the API agree by construction.

---

## 6. Response Envelope (the contract)

Every endpoint returns **exactly one** of these.

**Success**
```jsonc
{ "data": <payload> }   // HTTP 2xx
```

**Failure**
```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",        // stable machine-readable code
    "message": "Human-readable summary",
    "details": { /* optional, e.g. Zod field issues */ }
  }
}
```

**Error codes → HTTP status**

| `code` | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod parse failed; `details` carries flattened field errors |
| `UNAUTHORIZED` | 401 | Missing/invalid/expired JWT |
| `FORBIDDEN` | 403 | Authenticated but not the owner |
| `NOT_FOUND` | 404 | Resource doesn't exist (or isn't yours — return 404 to avoid leaking existence) |
| `CONFLICT` | 409 | e.g. email already registered |
| `INTERNAL` | 500 | Unexpected; never leak internals in `message` |

**Helper signatures** (`src/lib/api-response.ts`)
```ts
ok<T>(data: T, status = 200): Response
fail(code: ErrorCode, message: string, status: number, details?: unknown): Response
```
Route handlers only ever `return ok(...)` or `return fail(...)`. Wrap each handler body in a try/catch that funnels unknown errors into `fail("INTERNAL", ..., 500)`.

---

## 7. Folder Structure

Production-minded, App-Router layout with a `src/` dir and a clear service layer.

```
taskco/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── prisma.config.ts
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/                     # route group: unauthenticated pages
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (app)/                      # route group: authenticated pages
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   └── projects/
│   │   │       └── [id]/
│   │   │           └── page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── login/route.ts
│   │   │   │   └── me/route.ts
│   │   │   ├── projects/
│   │   │   │   ├── route.ts            # GET (list), POST (create)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts        # GET, PATCH, DELETE
│   │   │   │       └── tasks/
│   │   │   │           └── route.ts    # GET (list+filter), POST (create)
│   │   │   └── tasks/
│   │   │       └── [id]/
│   │   │           └── route.ts        # PATCH, DELETE
│   │   ├── layout.tsx                  # root layout
│   │   ├── globals.css                 # @import "tailwindcss";
│   │   ├── not-found.tsx               # 404
│   │   └── error.tsx                   # error boundary
│   ├── components/
│   │   ├── ui/                         # primitives: button, input, badge, spinner
│   │   └── features/                   # composed: project-card, task-row, task-filters
│   ├── lib/
│   │   ├── db.ts                       # Prisma singleton
│   │   ├── auth.ts                     # hashPassword, verifyPassword, signJwt, verifyJwt, getUserFromRequest
│   │   ├── api-response.ts             # ok(), fail(), ErrorCode
│   │   ├── api-client.ts               # typed fetch wrapper for the frontend
│   │   └── validations/
│   │       ├── auth.schema.ts
│   │       ├── project.schema.ts
│   │       └── task.schema.ts
│   ├── server/
│   │   └── services/
│   │       ├── auth.service.ts
│   │       ├── project.service.ts
│   │       └── task.service.ts
│   ├── types/
│   │   └── index.ts                    # shared/derived types
│   ├── generated/
│   │   └── prisma/                     # Prisma 7 client output (gitignored)
│   └── proxy.ts                        # route protection (Next.js 16; was middleware.ts)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── setup.ts
├── .env
├── .env.example
├── .gitignore
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── taskco-plan.md                      # this file
```

**Layer responsibilities (one-liners)**
- `app/api/**/route.ts` — HTTP boundary only. Validate → auth → call service → `ok`/`fail`.
- `server/services/*` — business logic + Prisma. No HTTP, no `Request`/`Response`.
- `lib/*` — cross-cutting utilities (db, auth, envelope, fetch client, schemas).
- `components/ui` vs `components/features` — dumb primitives vs domain-aware compositions.

> **Next.js 16 note:** the root middleware file was renamed `middleware.ts → proxy.ts`. Use `proxy.ts` for redirecting unauthenticated users away from `(app)` pages. API auth is still enforced inside each route handler via `getUserFromRequest`, not solely in proxy.

---

## 8. Naming Conventions

**Files & folders: `kebab-case`** (your call, applied consistently).
- `task-filters.tsx`, `project.service.ts`, `api-response.ts`, `auth.schema.ts`.
- Component files are kebab-case too: `project-card.tsx` **exports** `ProjectCard`.
- Route segments are inherently lowercase; dynamic segments use `[id]`.

**Identifiers follow language norms** (kebab-case is illegal for JS identifiers):
| Thing | Case | Example |
|---|---|---|
| React components, types, interfaces | `PascalCase` | `ProjectCard`, `TaskDTO` |
| Variables, functions, hooks | `camelCase` | `createTask`, `useProjects` |
| Constants, enum values | `UPPER_SNAKE_CASE` | `TODO`, `IN_PROGRESS` |
| DB columns / Prisma fields | `camelCase` | `passwordHash`, `dueDate` |
| API routes | lowercase, plural nouns | `/api/projects/:id/tasks` |

Rule of thumb: **the file is kebab-case, what's inside it follows JS/TS conventions.**

---

## 9. Frontend Pages

| Page | Route | Contents |
|---|---|---|
| Login | `/login` | Email + password form → POST `/api/auth/login`, store JWT, redirect to dashboard |
| Register | `/register` | Name + email + password form → POST `/api/auth/register` |
| Dashboard | `/dashboard` | Project list as cards, each showing name, color, and task count; "New project" action |
| Project view | `/projects/:id` | Task list with: filter buttons (status + priority), priority badges, due dates, **inline status toggle** (TODO → IN_PROGRESS → DONE via PATCH `/api/tasks/:id`) |
| 404 | `app/not-found.tsx` | Friendly not-found |
| Error | `app/error.tsx` | Client error boundary with retry |

**Frontend conventions**
- All network calls go through `lib/api-client.ts`, which knows the envelope: it returns `data` on success and throws a typed error carrying `error.code` on failure.
- Forms validate with the **same** Zod schemas the API uses (import from `lib/validations`).
- Reusable badges: a `PriorityBadge` (LOW/MEDIUM/HIGH) and `StatusBadge` (TODO/IN_PROGRESS/DONE) in `components/ui`.

---

## 10. Build Order (bottom-up — confirmed)

Each phase is independently verifiable before moving on. ✅ = done.

- [ ] **Phase 0 — Scaffold.** `create-next-app@latest` (TS, Tailwind, App Router, `src/`, import alias `@/*`). Docker Postgres. `.env` + `.env.example`.
- [ ] **Phase 1 — Prisma schema.** Write `schema.prisma`, run first migration, add `seed.ts`, build `lib/db.ts` singleton. *Verify:* `prisma studio` shows tables; seed runs.
- [ ] **Phase 2 — Shared infra.** `lib/api-response.ts` (envelope), `lib/auth.ts` (hash/verify/JWT), `lib/validations/*`. *Verify:* unit tests for hashing + JWT round-trip.
- [ ] **Phase 3 — Auth endpoints.** `register`, `login`, `me` + `getUserFromRequest`. *Verify:* register → login → me with the returned token.
- [ ] **Phase 4 — Projects endpoints.** CRUD, ownership-scoped, task count on detail. *Verify:* a second user cannot see user one's projects (expect 404).
- [ ] **Phase 5 — Tasks endpoints.** List with `status`/`priority` filters, create, update, delete. *Verify:* filters return correct subsets; cascade on project delete.
- [ ] **Phase 6 — Frontend.** `api-client` → login/register → dashboard → project view (filters, badges, inline status toggle) → 404/error states.
- [ ] **Phase 7 — Polish.** Loading/empty states, optimistic status toggle, basic a11y pass.

**Definition of done per endpoint:** Zod-validated input, auth enforced, ownership scoped, returns the envelope, has at least one integration test.

---

## 11. Testing

**Recommendation for a project this size: Vitest.** It's the right pick over Jest here — faster, native ESM + TypeScript, near-zero config, and a single tool covers unit and integration. Don't add Jest.

| Need | Tool | Scope |
|---|---|---|
| Pure logic (hashing, JWT, envelope helpers, Zod schemas) | **Vitest** | unit — fast, no DB |
| Services + route handlers against a real schema | **Vitest** + Postgres test DB (or `pglite`) | integration — the highest-value tests |
| Components (badges, forms, task row) | **Vitest** + **React Testing Library** + `jsdom` | component |
| Critical end-to-end flow (optional) | **Playwright** | login → create project → create task → toggle status |

**Strategy**
- Put the most effort into **service-level integration tests** — they cover business logic and ownership rules where bugs actually hurt. Because logic lives in services (not handlers), you can test it by calling functions directly, no HTTP server needed.
- Keep route-handler tests thin: one happy path + one auth-failure + one validation-failure per endpoint.
- Reset DB state between tests (`beforeEach` truncate) and create the schema once per file (`beforeAll`).
- Add Playwright only once the app works, and only for the one or two flows that must never break.

`vitest.config.ts` lives at root; shared setup (env, DB lifecycle) in `tests/setup.ts`.

---

## 12. Environment & Local Setup

`.env.example` (commit this; never commit `.env`):
```
DATABASE_URL="postgresql://taskco:taskco@localhost:5432/taskco?schema=public"
JWT_SECRET="replace-with-a-long-random-string"
JWT_EXPIRES_IN="7d"
```

Quick start:
```bash
docker run --name taskco-db -e POSTGRES_USER=taskco -e POSTGRES_PASSWORD=taskco -e POSTGRES_DB=taskco -p 5432:5432 -d postgres:15
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

`.gitignore` must include: `node_modules`, `.env`, `.next`, `src/generated`.

---

## 13. Future Add-ons (parking lot)

Not in v1, but the structure leaves room for them without rework:
- Refresh tokens / token rotation, password reset.
- Project sharing / collaborators (turns the `owner` relation into a membership join table).
- Task sorting, search, pagination on list endpoints.
- Soft deletes + audit timestamps.
- Rate limiting on auth endpoints.
- Subtasks / comments / labels.
- Optimistic UI everywhere + React Query/SWR for caching.

---

## Appendix — Conventions cheat sheet

- **Envelope:** every response is `{ data }` or `{ error: { code, message, details? } }`. No exceptions.
- **Files:** kebab-case. **Identifiers:** PascalCase types/components, camelCase values, UPPER_SNAKE constants.
- **Handlers:** validate → auth → service → envelope. No Prisma in handlers.
- **Services:** all business logic + Prisma, ownership-scoped, no HTTP types.
- **Validation:** Zod at every boundary; share schemas between API and forms.
- **Auth:** JWT via `jose`; verify inside handlers; protect pages in `proxy.ts`.