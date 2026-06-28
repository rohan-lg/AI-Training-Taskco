# TaskCo Frontend — Documentation

**Stack:** Vite 8 · React 19 · TypeScript 6 · Tailwind CSS v4 · React Router v8 · TanStack Query v5 · Zod v4  
**Dev server:** `pnpm dev` → http://localhost:5173  
**Tests:** `pnpm vitest run` → 52 tests across 4 suites  
**Build:** `pnpm build`

---

## Architecture Overview

```
Vite Dev Server (port 5173)
        │  /api/* requests
        ▼  (proxy strips /api prefix)
Fastify Backend (port 3000)
```

The SPA proxies every `/api/*` fetch to the Fastify backend at `localhost:3000`. No CORS configuration needed — the browser only ever talks to `localhost:5173`. The proxy is configured in `vite.config.ts`.

### Provider tree (runtime)

```
<QueryClientProvider>       ← TanStack Query cache
  <AuthProvider>            ← Auth state + localStorage sync
    <RouterProvider>        ← React Router data router
      <Layout>              ← App shell (header + Outlet)
        <ProtectedRoute>    ← Redirects unauthenticated users
          <Page />
```

---

## Folder Structure

```
taskco-web/
├── src/
│   ├── __tests__/
│   │   ├── test-utils.tsx          # Shared render helper + auth helpers
│   │   ├── login.test.tsx          # 13 login tests
│   │   ├── register.test.tsx       # 13 register tests
│   │   ├── dashboard.test.tsx      # 9 dashboard tests
│   │   └── project-view.test.tsx   # 14 project-view tests
│   ├── components/
│   │   ├── auth-form.tsx           # Shared login/register form (mode prop)
│   │   ├── layout.tsx              # App shell — header + Outlet
│   │   ├── project-card.tsx        # Dashboard project card
│   │   └── protected-route.tsx     # Auth guard — redirects to /login
│   ├── hooks/
│   │   ├── use-projects.ts         # useQuery for GET /projects
│   │   └── use-project.ts          # useQuery for GET /projects/:id + tasks
│   ├── lib/
│   │   ├── api-client.ts           # fetch wrapper — auto-attaches Bearer token
│   │   ├── auth-context.tsx        # React Context for auth state
│   │   ├── schemas.ts              # Zod schemas for form validation
│   │   ├── tokens.ts               # Design token class maps
│   │   └── types.ts                # Shared TypeScript interfaces
│   ├── pages/
│   │   ├── home.tsx                # / scaffold page
│   │   ├── login.tsx               # /login
│   │   ├── register.tsx            # /register
│   │   ├── dashboard.tsx           # /dashboard — project list
│   │   └── project.tsx             # /projects/:id — tasks + filters
│   ├── index.css                   # @import "tailwindcss"; (v4, no config file)
│   ├── main.tsx                    # App entry — providers + RouterProvider
│   ├── router.tsx                  # Route table
│   └── test-setup.ts               # Vitest setup — imports jest-dom matchers
├── vite.config.ts                  # Vite + Tailwind + proxy + test config
└── tsconfig.app.json
```

---

## Key Files

### `src/lib/api-client.ts`

Central HTTP client. **Every API call in the app must go through `apiFetch`** — no raw `fetch` in components or hooks.

```ts
apiFetch<T>(path: string, options?: RequestInit): Promise<T>
```

- Prepends `/api` base URL (proxied to Fastify in dev)
- Reads `taskco_token` from `localStorage` and attaches `Authorization: Bearer <token>` automatically
- Parses JSON and unwraps the `{ data }` envelope from the backend
- Throws `ApiError` for any non-OK response or `body.error` field

**`ApiError`** fields:
| Field | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable error message from backend |
| `code` | `string` | Backend error code (`UNAUTHORIZED`, `CONFLICT`, etc.) |
| `status` | `number` | HTTP status code |

Error code → HTTP status mapping matches the backend:
| Code | Status |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `INTERNAL` | 500 |

---

### `src/lib/auth-context.tsx`

React Context providing auth state across the entire app. Never read `localStorage` directly in components — use `useAuth()`.

```ts
const { user, token, isAuthenticated, login, logout } = useAuth()
```

| Member | Type | Description |
|---|---|---|
| `user` | `User \| null` | Logged-in user profile (`id`, `email`, `name`, `createdAt`) |
| `token` | `string \| null` | Raw JWT |
| `isAuthenticated` | `boolean` | `true` when `token` is non-null |
| `login(token, user)` | `function` | Persists to `localStorage`, updates state |
| `logout()` | `function` | Clears `localStorage`, resets state |

**localStorage keys:**
- `taskco_token` — the JWT (read by `apiFetch` automatically)
- `taskco_user` — JSON-serialized `User` object

**On logout:** call both `logout()` and `queryClient.clear()` to purge the TanStack cache (done in `Layout`).

---

### `src/lib/schemas.ts`

Zod schemas for client-side form validation. These mirror the backend's Zod schemas but are intentionally independent (the frontend validates before the network round-trip).

```ts
loginSchema    // { email: string, password: string }
registerSchema // { name: string, email: string, password: string }
```

Validation rules:
| Field | Rule |
|---|---|
| `email` | Required + valid email format |
| `password` (login) | Required (min 1 char) |
| `password` (register) | Min 8 characters |
| `name` | Required (min 1 char) |

---

### `src/lib/tokens.ts`

Design token maps. **Import from here for badges and buttons; never hardcode classes inline.**

```ts
priorityBadge.HIGH    // 'bg-red-100 text-red-800'
priorityBadge.MEDIUM  // 'bg-yellow-100 text-yellow-800'
priorityBadge.LOW     // 'bg-green-100 text-green-800'

statusBadge.TODO        // 'bg-gray-100 text-gray-800'
statusBadge.IN_PROGRESS // 'bg-blue-100 text-blue-800'
statusBadge.DONE        // 'bg-green-100 text-green-800'

button.primary  // full blue submit button class string
button.danger   // full red delete button class string

card            // 'bg-white rounded-lg p-6'
```

---

### `src/lib/types.ts`

Shared TypeScript interfaces matching backend Prisma model shapes.

```ts
User          // id, email, name, createdAt
Project       // id, name, description, color, ownerId, createdAt
ProjectDetail // extends Project + taskCount: number
Task          // id, title, description, status, priority, dueDate, projectId, createdAt
```

`status` is `'TODO' | 'IN_PROGRESS' | 'DONE'`  
`priority` is `'HIGH' | 'MEDIUM' | 'LOW'`

---

### `src/components/auth-form.tsx`

Single controlled-component form shared by the login and register pages via a `mode` prop.

```tsx
<AuthForm mode="login" />
<AuthForm mode="register" />
```

**Validation flow:**
1. User submits → `loginSchema` or `registerSchema` runs via `safeParse`
2. On failure → per-field error messages rendered with `role="alert"`
3. On success → `apiFetch` called with validated data
4. API error → server error rendered under the form
5. Inputs and button disabled during `loading` state

**Post-success navigation:**
- `login` → `/dashboard`
- `register` → `/login` (user must sign in after registration)

---

### `src/components/protected-route.tsx`

Auth guard rendered as a parent layout route. Reads `isAuthenticated` from `useAuth()` and redirects to `/login` if `false`.

```tsx
// In router.tsx:
{ element: <ProtectedRoute />, children: [...protected routes...] }
```

---

### `src/components/layout.tsx`

App shell. Renders the top navigation bar with:
- "TaskCo" logo (links to `/dashboard` when logged in, `/login` otherwise)
- Logged-in user's name
- "Sign out" button (calls `logout()` + `queryClient.clear()` + navigates to `/login`)

The `<Outlet />` renders the current page below the header.

---

## Pages

### `/login` — `LoginPage`

Renders `<AuthForm mode="login" />`. Redirects to `/dashboard` if already authenticated.

### `/register` — `RegisterPage`

Renders `<AuthForm mode="register" />`. Redirects to `/dashboard` if already authenticated.

### `/dashboard` — `DashboardPage` (protected)

Fetches the authenticated user's projects with TanStack Query:

```ts
useQuery({ queryKey: ['projects'], queryFn: () => apiFetch('/projects') })
```

States rendered:
- **Loading** — "Loading projects…" with `role="status"`
- **Error** — error message with `role="alert"`
- **Empty** — "No projects yet."
- **Data** — grid of `<ProjectCard />` components

### `/projects/:id` — `ProjectPage` (protected)

Two concurrent queries:
1. `useProject(id)` → `GET /projects/:id` — project metadata + `taskCount`
2. `useTasks(id, { status, priority })` → `GET /projects/:id/tasks?status=&priority=`

**Filtering:** two `<select>` dropdowns for status and priority. Changing either value updates the `queryKey` which triggers an automatic refetch — no manual invalidation needed.

States:
- Project loading / error (404 shows "Project not found.", others show generic message)
- Task loading / error / empty / list

**Note:** `GET /projects/:id/tasks` is not yet implemented in the backend. The frontend renders correctly with an error or empty state until the backend adds this endpoint.

---

## Hooks

### `useProjects()`

```ts
// src/hooks/use-projects.ts
const { data: projects, isLoading, isError, error } = useProjects()
// data: Project[] | undefined
```

Query key: `['projects']`

### `useProject(id)`

```ts
// src/hooks/use-project.ts
const { data: project, isLoading, isError, error } = useProject(id)
// data: ProjectDetail | undefined (includes taskCount)
```

Query key: `['projects', id]`

### `useTasks(projectId, filters)`

```ts
const { data: tasks, isLoading, isError } = useTasks(id, { status: 'TODO', priority: 'HIGH' })
// data: Task[] | undefined
```

Query key: `['projects', id, 'tasks', { status, priority }]` — filters are part of the key so changing them refetches automatically.

---

## Routing

```
/              → redirects to /dashboard
/login         → LoginPage (public)
/register      → RegisterPage (public)
/home          → HomePage (public, scaffold)
/dashboard     → DashboardPage (protected)
/projects/:id  → ProjectPage (protected)
```

Protected routes are wrapped in `<ProtectedRoute />` which redirects unauthenticated users to `/login`.

---

## Tailwind CSS v4

This project uses Tailwind **v4** via the official Vite plugin — no PostCSS config file and no `tailwind.config.js`.

`src/index.css` contains a single line:
```css
@import "tailwindcss";
```

All utility classes used are stock Tailwind v4 classes. Design tokens are mapped in `src/lib/tokens.ts`.

---

## Testing

**Runner:** Vitest v4 with jsdom environment  
**Libraries:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`  
**Total:** 52 tests, 4 suites

### Test approach

All tests mock `apiFetch` via `vi.mock('../lib/api-client')` with a manual factory that keeps `ApiError` as a real class so `instanceof` checks in components work correctly.

Tests render pages through `createMemoryRouter` + `RouterProvider` wrapped in `QueryClientProvider` and `AuthProvider` — this mirrors the real provider tree and tests actual user flows (navigation, state changes) without mocking React Router internals.

### `src/__tests__/test-utils.tsx`

```ts
renderWithRouter(routes, { initialEntries })  // render in a memory router with providers
setAuthToken()   // set localStorage token + user (for protected route tests)
clearAuth()      // clear localStorage (called in beforeEach)
```

### Test coverage by suite

**`login.test.tsx` — 13 tests:**
| # | Test | Verifies |
|---|---|---|
| 1 | Renders form fields | DOM structure |
| 2 | Renders register link | Navigation |
| 3 | Empty email → "Email is required" | Zod validation |
| 4 | Invalid email format → error | Zod validation |
| 5 | Empty password → "Password is required" | Zod validation |
| 6 | Validation failure → apiFetch not called | No extra requests |
| 7 | Typing clears field error | UX |
| 8 | Valid submit → correct apiFetch payload | API contract |
| 9 | Success → navigates to /dashboard | Navigation |
| 10 | Success → stores token in localStorage | Auth persistence |
| 11 | 401 UNAUTHORIZED → shows error message | Error handling |
| 12 | 409 CONFLICT → "email already exists" | Error mapping |
| 13 | Unknown error → generic message | Error fallback |
| 14 (bonus) | Loading → inputs + button disabled | Loading UX |

**`register.test.tsx` — 13 tests:**
| # | Test | Verifies |
|---|---|---|
| 1 | Renders all three fields | DOM structure |
| 2 | Renders login link | Navigation |
| 3 | Empty name → "Name is required" | Zod validation |
| 4 | Empty email → "Email is required" | Zod validation |
| 5 | Invalid email → error | Zod validation |
| 6 | Password < 8 chars → error | Zod min-length |
| 7 | Empty password → error | Zod min-length |
| 8 | Validation failure → apiFetch not called | No extra requests |
| 9 | Valid submit → correct payload | API contract |
| 10 | Success → navigates to /login | Navigation |
| 11 | 409 CONFLICT → "email already exists" | Error mapping |
| 12 | 400 VALIDATION_ERROR → shows message | Error handling |
| 13 | Unknown error → generic message | Error fallback |
| 14 (bonus) | Loading → fields + button disabled | Loading UX |
| 15 (bonus) | Typing clears field error | UX |

**`dashboard.test.tsx` — 9 tests:**
| # | Test | Verifies |
|---|---|---|
| 1 | Loading state rendered | Loading UX |
| 2 | Project cards rendered from API data | Data rendering |
| 3 | Project description shown | Data rendering |
| 4 | Card links to /projects/:id | Navigation |
| 5 | Empty state when projects = [] | Edge case |
| 6 | Error state when fetch fails | Error handling |
| 7 | Unauthenticated → redirect to /login | Auth guard |
| 8 | Calls GET /projects endpoint | API contract |
| 9 | "Projects" heading rendered | DOM structure |

**`project-view.test.tsx` — 14 tests:**
| # | Test | Verifies |
|---|---|---|
| 1 | Loading state rendered | Loading UX |
| 2 | Project name shown in header | Data rendering |
| 3 | Project description shown | Data rendering |
| 4 | Task count shown | Data rendering |
| 5 | Task titles rendered | Data rendering |
| 6 | Status + priority badges | Token classes |
| 7 | Empty state when tasks = [] | Edge case |
| 8 | 404 → "Project not found." | Error mapping |
| 9 | 500 → generic error message | Error handling |
| 10 | "← Dashboard" link exists | Navigation |
| 11 | Status filter dropdown rendered | Filter UI |
| 12 | Priority filter dropdown rendered | Filter UI |
| 13 | Changing status → new task fetch | Query key reactivity |
| 14 | Changing priority → new task fetch | Query key reactivity |

---

## API Endpoints (frontend perspective)

All calls go through `apiFetch` which prepends `/api`:

| Method | Path | Auth | Used by | Returns |
|---|---|---|---|---|
| `POST` | `/auth/register` | — | `AuthForm (register)` | `{ token, user }` |
| `POST` | `/auth/login` | — | `AuthForm (login)` | `{ token, user }` |
| `GET` | `/projects` | ✅ Bearer | `useProjects` | `Project[]` |
| `GET` | `/projects/:id` | ✅ Bearer | `useProject` | `ProjectDetail` |
| `GET` | `/projects/:id/tasks` | ✅ Bearer | `useTasks` | `Task[]` *(backend pending)* |

The Bearer token is attached automatically by `apiFetch` from `localStorage`.

---

## Auth Flow

```
Register (/register)
  └─ apiFetch POST /auth/register
  └─ success → navigate to /login

Login (/login)
  └─ apiFetch POST /auth/login
  └─ success → login(token, user) → localStorage → navigate to /dashboard

Protected route visit
  └─ ProtectedRoute reads isAuthenticated
  └─ false → <Navigate to="/login" replace />

Sign out (Layout header)
  └─ logout() → clear localStorage
  └─ queryClient.clear() → purge cache
  └─ navigate to /login
```

---

## Environment

No `.env` file needed for development — all API calls use the Vite proxy (`/api → localhost:3000`).

For production, set the backend URL in `vite.config.ts` → `server.proxy.'/api'.target` or configure a reverse proxy at the deployment level.

---

## Commit message (for this changeset)

```
feat: scaffold Taskco frontend with auth, dashboard, and project view

- Vite + React 19 + TypeScript + Tailwind v4 + React Router v8 + TanStack Query v5
- Steps 2–5: Login/Register forms (Zod validation), Dashboard (project list),
  Project view (tasks + status/priority filters)
- AuthContext for JWT persistence via localStorage; apiFetch auto-attaches Bearer
- 52 Vitest + Testing Library tests covering validation, API errors, navigation,
  auth guard, empty states, and filter-driven query key reactivity
```
