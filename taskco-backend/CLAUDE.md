# Taskco Backend — Claude Instructions

## Stack
TypeScript 5.x (`strict: true`), Fastify 5, Prisma 7 (`prisma-client` WASM generator), PostgreSQL via Neon, Zod 4, bcryptjs, jose, pnpm, Vitest.

## Entry Point
`src/index.ts` — Fastify server on port 3000.

## Folder Layout
```
src/
  index.ts                        # server bootstrap — loads dotenv first, registers plugins
  routes/
    auth.ts                       # POST /auth/register (login added later)
  services/
    auth.service.ts               # registerUser — hashes password, creates user, signs JWT
  lib/
    db.ts                         # Prisma singleton (import from here only)
    api-response.ts               # ok() / fail() envelope helpers
    auth.ts                       # hashPassword, signJwt (verifyJwt + getUserFromRequest added later)
    validations/
      auth.schema.ts              # registerSchema (loginSchema added later)
  generated/
    prisma/                       # gitignored — Prisma 7 WASM client output
prisma/
  schema.prisma
  migrations/                     # committed — never edit migration SQL by hand
prisma.config.ts                  # Prisma 7 CLI config — datasource URL + dotenv bootstrap
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

**Field rules:**
- Field is `passwordHash`, not `password` or `hashedPassword`.
- No `updatedAt`, `role`, `avatar`, or `isActive` on User.
- No `projects` relation yet — added in a later lab.

## Architecture Rules
- Routes: validate input → check auth → call service → return envelope. No Prisma in routes.
- Services: all business logic and Prisma calls. No HTTP types (`Request`/`Reply`) in services.
- One Prisma client singleton at `src/lib/db.ts`. Never instantiate PrismaClient elsewhere.

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
Helpers: `ok(data, status?)` and `fail(code, message, status, details?)` from `src/lib/api-response.ts`.
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
Verify tokens inside route handlers with `getUserFromRequest` (not yet implemented — added with login).
Never trust a client-supplied user ID — always derive it from the verified token.

**Password hashing:** bcryptjs, 12 salt rounds. Field is always `passwordHash`. Never return it in responses — use Prisma `select` to exclude it explicitly.

## Implemented Endpoints

| Method | Path | Auth | Status |
|---|---|---|---|
| `POST` | `/auth/register` | — | ✅ |

**Register flow:** Zod parse → hash password (bcryptjs, 12 rounds) → `prisma.user.create` with `select` (no passwordHash) → sign JWT → return `{ data: { token, user } }`.
Prisma error `P2002` on `email` → 409 CONFLICT.

## Prisma Config (Prisma 7)
- `prisma.config.ts` at the repo root loads `.env` via `import 'dotenv/config'` then sets `datasource.url`.
- Add `&connect_timeout=30` to `DATABASE_URL` — required for Neon cold-start on first connection.
- Generator: `provider = "prisma-client"` (WASM, no Rust binary at runtime), output: `src/generated/prisma`.
- Runtime client in `src/lib/db.ts` uses `@prisma/adapter-pg` (`pg.Pool` + `PrismaPg`) — required by the WASM client.
- Import the client only through `src/lib/db.ts`.
- Schema changes: edit `prisma/schema.prisma`, then run `pnpm prisma migrate dev --name <migration-name>`, then `pnpm prisma generate`.
- Migration files in `prisma/migrations/` are committed and must never be edited by hand.
- `db push` is for quick iteration without a migration history; use `migrate dev` for all model changes.

## Required Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (include `&connect_timeout=30`) |
| `JWT_SECRET` | HS256 signing key — must be a long random string in production |
