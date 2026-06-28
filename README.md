# TaskCo

A multi-user task management API with a React frontend. Users register, log in, and own **projects**. Each project holds **tasks** with a status (`TODO` / `IN_PROGRESS` / `DONE`), a priority (`LOW` / `MEDIUM` / `HIGH`), and an optional due date. Tasks are filterable by status and priority on the project detail page.

## What TaskCo is NOT

The following are intentionally out of scope for this version:

- OAuth / social login
- Email verification or password reset
- Real-time updates (no WebSockets or SSE)
- File or image uploads
- Role-based permissions (every user owns their own data; no team/org model)
- CI/CD pipeline
- Admin panel

---

## Tech stack

### Backend (`taskco-backend/`)

| Package | Version | Purpose |
|---------|---------|---------|
| TypeScript | ^5.0.0 | Language |
| Fastify | ^5.0.0 | HTTP server |
| Prisma | ^7.8.0 | ORM (WASM client, Neon-compatible) |
| `@prisma/adapter-pg` | ^7.8.0 | pg adapter for Prisma WASM |
| pg | ^8.22.0 | PostgreSQL driver |
| Zod | ^4.4.3 | Request validation |
| bcryptjs | ^3.0.3 | Password hashing (12 salt rounds) |
| jose | ^6.2.3 | JWT sign / verify (HS256, 7-day expiry) |
| dotenv | ^17.4.2 | `.env` loading |
| Vitest | ^4.1.9 | Integration tests |

Node.js requirement: **>=22** (see `engines` in `taskco-backend/package.json`).

### Frontend (`taskco-web/`)

| Package | Version | Purpose |
|---------|---------|---------|
| React | ^19.2.7 | UI framework |
| React DOM | ^19.2.7 | DOM renderer |
| Vite | ^8.1.0 | Dev server and bundler |
| TypeScript | ~6.0.2 | Language |
| Tailwind CSS | ^4.3.1 | Styling (v4 — no config file, single `@import`) |
| `@tailwindcss/vite` | ^4.3.1 | Tailwind v4 Vite plugin |
| React Router | ^8.0.1 | Client-side routing (`react-router`, not `react-router-dom`) |
| TanStack Query | ^5.101.1 | Server state and caching |
| Zod | ^4.4.3 | Client-side form validation |
| Vitest | ^4.1.9 | Component tests |

Package manager: **pnpm** (both workspaces use separate `pnpm-lock.yaml` files).

---

## Prerequisites

- **Node.js >= 22** (`node --version`)
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** — a Neon serverless instance is recommended (free tier works). Any standard PostgreSQL 15+ instance works. No Docker setup is included.

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd Taskco-training
```

### 2. Install dependencies (each package separately)

```bash
cd taskco-backend && pnpm install
cd ../taskco-web && pnpm install
```

### 3. Configure the backend environment

```bash
cd taskco-backend
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. For Neon: `postgresql://user:pass@host/db?sslmode=require&connect_timeout=30` |
| `JWT_SECRET` | Yes | Random string, **minimum 32 characters**. The server refuses to start if this is missing or too short. Generate one with: `openssl rand -hex 32` |
| `HOST` | No | Address to bind to. Defaults to `127.0.0.1`. Set `0.0.0.0` in production containers. |
| `PORT` | No | Port to listen on. Defaults to `3000`. |

> JWT expiry is hardcoded at **7 days** and is not currently configurable via env var.

The frontend has no `.env` file. The Vite dev server proxies `/api/*` to `http://localhost:3000` — if you change `PORT`, update `vite.config.ts` to match.

### 4. Run database migrations

```bash
cd taskco-backend
pnpm prisma migrate dev
```

This creates the `User` and `Project` tables. No seed data is included.

### 5. Start the servers

In two terminals:

```bash
# Terminal 1 — backend (http://localhost:3000)
cd taskco-backend
pnpm dev

# Terminal 2 — frontend (http://localhost:5173)
cd taskco-web
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Running tests

```bash
# Backend integration tests (hit the real database — set DATABASE_URL first)
cd taskco-backend
pnpm vitest run

# Frontend component tests (jsdom, no network)
cd taskco-web
pnpm vitest run
```

Backend tests use the `@test.taskco` email domain and clean up after themselves via `beforeEach` / `afterAll`. Neon free tier can cold-start slowly — the test timeout is set to 30 seconds.

---

## API reference

All responses use a consistent envelope:

```json
// success
{ "data": { ... } }

// error
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

All protected routes require `Authorization: Bearer <token>`.

### Authentication

#### `POST /auth/register`

Creates a new user account and returns a JWT.

Request body:
```json
{
  "email": "alice@example.com",   // max 255 chars
  "password": "hunter2abc",       // 8–128 chars
  "name": "Alice"                 // max 100 chars
}
```

Responses:
- `201` — `{ data: { token, user: { id, email, name, createdAt } } }`
- `400` — `VALIDATION_ERROR` — invalid input
- `409` — `CONFLICT` — email already registered

#### `POST /auth/login`

Authenticates an existing user.

Request body:
```json
{
  "email": "alice@example.com",
  "password": "hunter2abc"
}
```

Responses:
- `200` — `{ data: { token, user: { id, email, name, createdAt } } }`
- `400` — `VALIDATION_ERROR`
- `401` — `UNAUTHORIZED` — wrong credentials (same message for "not found" and "wrong password" — no email enumeration)

#### `GET /auth/me` 🔒

Returns the authenticated user's profile.

Responses:
- `200` — `{ data: { id, email, name, createdAt } }`
- `401` — missing or invalid token

---

### Projects

#### `POST /projects` 🔒

Creates a project owned by the authenticated user.

Request body:
```json
{
  "name": "My Project",                   // required, max 100 chars
  "description": "Optional description",  // optional, max 1000 chars
  "color": "#3b82f6"                      // optional hex color (#RGB, #RRGGBB, or #RRGGBBAA); defaults to #3b82f6
}
```

Responses:
- `201` — `{ data: { project } }`
- `400` — `VALIDATION_ERROR`
- `401` — unauthenticated

#### `GET /projects` 🔒

Returns all projects owned by the authenticated user.

Response `200`:
```json
{ "data": { "projects": [ { "id", "name", "description", "color", "ownerId", "createdAt" } ] } }
```

#### `GET /projects/:id` 🔒

Returns a single project with its task count.

Response `200`:
```json
{ "data": { "project": { "id", "name", "description", "color", "ownerId", "createdAt", "taskCount": 0 } } }
```

- `404` — project not found, or belongs to a different user (ownership is not revealed)

#### `PATCH /projects/:id` 🔒

Partially updates a project. All fields optional.

Request body: any subset of `{ name, description, color }` with the same constraints as `POST /projects`.

Response `200` — `{ data: { project } }` | `404` — not found or wrong owner

#### `DELETE /projects/:id` 🔒

Deletes a project.

Response `204` — no body | `404` — not found or wrong owner

---

### Tasks _(not yet implemented)_

The routes below are planned for the next iteration. They are listed here for reference but **do not exist yet** — the `Task` model has not been added to the database schema.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:id/tasks` | List tasks for a project (supports `?status=` and `?priority=` filters) |
| `POST` | `/projects/:id/tasks` | Create a task |
| `PATCH` | `/tasks/:id` | Update a task (status, priority, title, etc.) |
| `DELETE` | `/tasks/:id` | Delete a task |

Planned request body for `POST /projects/:id/tasks`:
```json
{
  "title": "Fix login bug",
  "description": "Crashes on mobile",
  "priority": "HIGH",
  "dueDate": "2024-12-31T00:00:00.000Z"
}
```

---

## Project structure

```
Taskco-training/
├── taskco-backend/
│   ├── prisma/
│   │   ├── schema.prisma          # User + Project models (Task coming soon)
│   │   └── migrations/            # Committed migration history
│   ├── src/
│   │   ├── index.ts               # Entry point — env guard, server listen
│   │   ├── app.ts                 # buildApp() factory — registers routes
│   │   ├── routes/
│   │   │   ├── auth.ts            # POST /auth/register, /login, GET /auth/me
│   │   │   └── projects.ts        # CRUD /projects and /projects/:id
│   │   ├── services/
│   │   │   ├── auth.service.ts    # registerUser, loginUser, getMe
│   │   │   └── project.service.ts # createProject, listProjects, etc.
│   │   └── lib/
│   │       ├── auth.ts            # hashPassword, verifyPassword, signJwt, verifyJwt
│   │       ├── authenticate.ts    # Fastify preHandler — validates Bearer token
│   │       ├── api-response.ts    # ok() / fail() envelope helpers
│   │       ├── db.ts              # Prisma singleton
│   │       └── validations/
│   │           ├── auth.schema.ts
│   │           └── project.schema.ts
│   └── tests/
│       ├── auth.test.ts           # 13 integration tests
│       └── projects.test.ts       # 25 integration tests
│
└── taskco-web/
    ├── src/
    │   ├── lib/
    │   │   ├── api-client.ts      # apiFetch<T>() — wraps fetch, unwraps { data }
    │   │   ├── auth-context.tsx   # AuthContext — token + user, localStorage
    │   │   ├── schemas.ts         # Zod schemas for forms
    │   │   ├── tokens.ts          # Design token maps (colors, badge classes)
    │   │   └── types.ts           # Shared TS interfaces
    │   ├── hooks/
    │   │   ├── use-projects.ts    # useProjects, useCreateProject
    │   │   ├── use-project.ts     # useProject(id)
    │   │   └── use-tasks.ts       # useTasks, useCreateTask, useUpdateTask
    │   ├── components/
    │   │   ├── auth-form.tsx
    │   │   ├── layout.tsx
    │   │   ├── new-project-modal.tsx
    │   │   ├── new-task-form.tsx
    │   │   ├── project-card.tsx
    │   │   └── protected-route.tsx
    │   ├── pages/
    │   │   ├── auth.tsx           # /login, /register
    │   │   ├── dashboard.tsx      # /dashboard — project list
    │   │   └── project.tsx        # /projects/:id — task list + filters
    │   └── router.tsx
    └── vite.config.ts             # Dev proxy: /api → http://localhost:3000
```

---

## Known security gaps

These were identified in a pre-production security review. They require additional packages or design changes and are not yet implemented:

| Gap | Risk | What to do |
|-----|------|-----------|
| **No CORS policy** | Any origin can make cross-origin requests | Install `@fastify/cors`; allowlist the frontend origin |
| **No rate limiting on auth routes** | `POST /auth/login` accepts unlimited attempts — brute-force risk | Install `@fastify/rate-limit`; apply to `/auth/*` (e.g. 10 req/min per IP) |
| **JWT stored in `localStorage`** | Readable by any JavaScript on the page — XSS leads to session theft | Switch to `HttpOnly; Secure; SameSite=Strict` cookies via `@fastify/cookie` |
| **Registration 409 reveals email existence** | `POST /auth/register` returns `409 CONFLICT` if the email is taken — allows email enumeration | Return a generic response that does not confirm or deny whether the email is registered |
| **SSL mode** | `pg` warns that `sslmode=require` will weaken in a future major version | Update `DATABASE_URL` to use `sslmode=verify-full` before upgrading `pg` to v9 |

---

## Environment variables reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | HS256 signing key, min 32 characters |
| `HOST` | No | `127.0.0.1` | Bind address (`0.0.0.0` for containers) |
| `PORT` | No | `3000` | Server port |
