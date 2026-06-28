# Taskco Backend — Claude Instructions

## Stack
TypeScript 5.x (`strict: true`), Fastify 5, Prisma 7 (`prisma-client` WASM generator), PostgreSQL via Neon, Zod 4, bcryptjs, jose, pnpm, Vitest.

## Entry Point
`src/index.ts` — Fastify server on port 3000.

## Folder Layout
```
src/
  index.ts                        # server entry point — loads dotenv, calls buildApp({ logger: true })
  app.ts                          # buildApp(opts?) factory — registers authRoutes + projectRoutes
  routes/
    auth.ts                       # POST /auth/register, POST /auth/login, GET /auth/me
    projects.ts                   # POST/GET /projects, GET/PATCH/DELETE /projects/:id
  services/
    auth.service.ts               # registerUser, loginUser, getMe
    project.service.ts            # createProject, listProjects, getProjectById, updateProject, deleteProject
  lib/
    db.ts                         # Prisma singleton (import from here only)
    api-response.ts               # ok() / fail() envelope helpers
    auth.ts                       # hashPassword, verifyPassword, signJwt, verifyJwt
    authenticate.ts               # authenticate preHandler — reads Bearer token, sets request.user
    validations/
      auth.schema.ts              # registerSchema, loginSchema
      project.schema.ts           # createProjectSchema, updateProjectSchema
  types/
    fastify.d.ts                  # FastifyRequest augmentation — adds request.user: { userId, email }
  generated/
    prisma/                       # gitignored — Prisma 7 WASM client output
tests/
  setup.ts                        # vitest setup — loads dotenv/config
  auth.test.ts                    # 13 integration tests (register, login, /auth/me)
  projects.test.ts                # 18 integration tests (CRUD + ownership isolation)
prisma/
  schema.prisma
  migrations/                     # committed — never edit migration SQL by hand
prisma.config.ts                  # Prisma 7 CLI config — datasource URL + dotenv bootstrap
vitest.config.ts                  # test environment: node, setupFiles: tests/setup.ts, timeout: 30s
```

## Data Model

### User
| Field | Type | Constraint |
|---|---|---|
| `id` | `String` | `@id @default(cuid())` |
| `email` | `String` | `@unique` |
| `passwordHash` | `String` | never store plaintext passwords |
| `name` | `String` | — |
| `createdAt` | `DateTime` | `@default(now())` |
| `projects` | `Project[]` | relation to owned projects |

**Field rules:**
- Field is `passwordHash`, not `password` or `hashedPassword`.
- No `updatedAt`, `role`, `avatar`, or `isActive` on User.

### Project
| Field | Type | Constraint |
|---|---|---|
| `id` | `String` | `@id @default(cuid())` |
| `name` | `String` | — |
| `description` | `String?` | optional |
| `color` | `String` | `@default("#3b82f6")` |
| `ownerId` | `String` | FK → User.id |
| `owner` | `User` | relation |
| `createdAt` | `DateTime` | `@default(now())` |

**Note:** `tasks Task[]` will be added when the Task model is created in a later lab.

## Architecture Rules
- Routes: validate input → run `authenticate` preHandler if protected → call service → return envelope. No Prisma in routes.
- Services: all business logic and Prisma calls. No HTTP types (`Request`/`Reply`) in services.
- One Prisma client singleton at `src/lib/db.ts`. Never instantiate PrismaClient elsewhere.

## Authentication Middleware

**`authenticate`** (`src/lib/authenticate.ts`) is a Fastify `preHandler` — NOT Express middleware.

Usage:
```ts
fastify.get('/protected', { preHandler: authenticate }, async (request, reply) => {
  // request.user is guaranteed: { userId: string; email: string }
});
```

**Failure cases handled by `authenticate`:**
- Missing / non-Bearer Authorization header → 401
- Malformed token → 401
- Expired token → 401

`request.user` is set to `{ userId: string; email: string }` — the JWT payload only. Services fetch the full profile from Prisma when needed.

## Critical: Ownership Scoping
Every query on user-owned resources (`Project`, `Task`) **must** filter by `ownerId`.
```ts
// Always scope by the authenticated user
prisma.project.findMany({ where: { ownerId: userId } })
```
Never query or mutate user-owned data without `ownerId` in the `where` clause.
Return **404** (not 403) when a resource exists but belongs to another user — avoids leaking existence.

## Response Envelope
All responses use `{ data }` on success, `{ error: { code, message, details? } }` on failure.
Helpers: `ok(reply, data, status?)` and `fail(reply, code, message, status, details?)` from `src/lib/api-response.ts`.
Every route handler is wrapped in try/catch; unknown errors → `fail("INTERNAL", ..., 500)`.

## Error Codes → HTTP Status
| Code | Status |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `INTERNAL` | 500 |

## Naming
- Files: `kebab-case` (`project-service.ts`)
- Types / interfaces: `PascalCase`
- Variables / functions: `camelCase`
- Constants / enum values: `UPPER_SNAKE_CASE`
- API routes: lowercase plural nouns (`/projects/:id/tasks`)

## Validation
Zod at every route boundary. Schemas live in `src/lib/validations/`. Parse input before calling any service; never pass raw request data to a service.

## Auth
JWT via `jose`. Algorithm: HS256. Expiry: `7d`. Secret from `process.env.JWT_SECRET`.
JWT payload: `{ userId, email }`.
Use `authenticate` preHandler on every protected route. Never trust a client-supplied user ID — always derive it from `request.user.userId`.

**Password hashing:** bcryptjs, 12 salt rounds. Field is always `passwordHash`. Never return it in responses — use Prisma `select` to exclude it explicitly.

## Implemented Endpoints

| Method | Path | Auth | Status |
|---|---|---|---|
| `POST` | `/auth/register` | — | ✅ |
| `POST` | `/auth/login` | — | ✅ |
| `GET` | `/auth/me` | ✅ | ✅ |
| `POST` | `/projects` | ✅ | ✅ |
| `GET` | `/projects` | ✅ | ✅ |
| `GET` | `/projects/:id` | ✅ | ✅ |
| `PATCH` | `/projects/:id` | ✅ | ✅ |
| `DELETE` | `/projects/:id` | ✅ | ✅ |

**Register flow:** Zod parse → hash password (bcryptjs, 12 rounds) → `prisma.user.create` with `select` (no passwordHash) → sign JWT → 201 `{ data: { token, user } }`.
Prisma error `P2002` on `email` → 409 CONFLICT.

**Login flow:** Zod parse → `prisma.user.findUnique` by email (selecting `passwordHash`) → `verifyPassword` (bcrypt.compare) → if user not found or password wrong return `null` → route returns 401. On success, strip `passwordHash` via destructure, sign JWT → 200 `{ data: { token, user } }`.
Both "user not found" and "wrong password" return the same 401 message — never reveal which condition failed.

**`/auth/me` flow (reference for all future authenticated routes):** `authenticate` preHandler verifies JWT → `getMe(request.user.userId)` → `prisma.user.findUnique` with `select` (no passwordHash) → 200 `{ data: user }`. Returns 404 if user no longer exists.

## Prisma Config (Prisma 7)
- `prisma.config.ts` at the repo root loads `.env` via `import 'dotenv/config'` then sets `datasource.url`.
- Add `&connect_timeout=30` to `DATABASE_URL` — required for Neon cold-start on first connection.
- Generator: `provider = "prisma-client"` (WASM, no Rust binary at runtime), output: `src/generated/prisma`.
- Runtime client in `src/lib/db.ts` uses `@prisma/adapter-pg` (`pg.Pool` + `PrismaPg`) — required by the WASM client.
- Import the client only through `src/lib/db.ts`.
- Schema changes: edit `prisma/schema.prisma`, then run `pnpm prisma migrate dev --name <migration-name>`, then `pnpm prisma generate`.
- Migration files in `prisma/migrations/` are committed and must never be edited by hand.
- `db push` is for quick iteration without a migration history; use `migrate dev` for all model changes.

## Testing

**Runner:** Vitest (`pnpm test`). Do not use Jest or Supertest.
**App instance:** `buildApp()` from `src/app.ts` — creates a Fastify app with `logger: false` by default. Use `app.inject()` for HTTP assertions.
**Database:** Tests hit the real Neon database. Test emails use the `@test.taskco` domain. `beforeEach` calls `prisma.user.deleteMany` with those emails to ensure isolation. `afterAll` does a final cleanup and calls `app.close()`.
**Timeout:** 30 s per test (Neon cold-start on first connection can be slow).
**Expired token test:** sign a JWT with `setExpirationTime(new Date(Date.now() - 1000))` — no sleep required.
**Coverage:** Register (5), Login (4), `/auth/me` (4) = 13 auth tests. Projects (POST×4, GET list×3, GET :id×3, PATCH×4, DELETE×4) = 18 project tests. **Total: 31 tests.**
**Cleanup order in project tests:** delete projects before users (FK constraint) — `prisma.project.deleteMany` then `prisma.user.deleteMany`.

## Required Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (include `&connect_timeout=30`) |
| `JWT_SECRET` | HS256 signing key — must be a long random string in production |
