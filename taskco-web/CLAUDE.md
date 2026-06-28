# taskco-web

React 19 frontend for the Taskco project management app. Talks to the Fastify API in `../taskco-api` (runs on port 3000).

## Stack

- **Vite 8** + **React 19** + **TypeScript 6** (strict)
- **Tailwind CSS v4** — single `@import "tailwindcss"` in `src/index.css`, no config file. Use `@tailwindcss/vite` plugin. Canonical classes: `shrink-0` not `flex-shrink-0`.
- **React Router v8** — import from `react-router` (not `react-router-dom`). Uses `createBrowserRouter` / `createMemoryRouter`.
- **TanStack Query v5** — `useQuery`, `useMutation`, `QueryCache`, `MutationCache`. Global 401 handler lives in `src/main.tsx` via `QueryCache`/`MutationCache` `onError` callbacks.
- **Zod v4** — client-side form validation only (`safeParse`). Schemas in `src/lib/schemas.ts`.
- **No** axios, Redux/Zustand, or UI kit. Fetch is done through `apiFetch` in `src/lib/api-client.ts`.

## Dev commands

```bash
pnpm dev          # Vite dev server on :5173, proxies /api → :3000
pnpm build        # tsc + vite build
pnpm test         # vitest run (single pass)
pnpm test:watch   # vitest watch
```

## File structure

```
src/
  lib/
    api-client.ts   # apiFetch<T>(), ApiError class
    auth-context.tsx # AuthContext, useAuth(), AuthProvider
    schemas.ts       # Zod schemas for form inputs
    tokens.ts        # Design token maps (priorityBadge, statusBadge, button, card)
    types.ts         # Shared TS types (Project, ProjectDetail, Task, User)
  hooks/
    use-projects.ts  # useProjects(), useCreateProject()
    use-project.ts   # useProject(id)
    use-tasks.ts     # useTasks(), useCreateTask(), useUpdateTask()
  components/
    auth-form.tsx        # Shared login/register form
    layout.tsx           # App shell (header + Outlet)
    new-project-modal.tsx
    new-task-form.tsx
    project-card.tsx
    protected-route.tsx
  pages/
    auth.tsx         # /login and /register
    dashboard.tsx    # /dashboard
    home.tsx         # / (marketing stub)
    project.tsx      # /projects/:id
  __tests__/
    test-utils.tsx         # renderWithRouter(), setAuthToken(), clearAuth()
    dashboard.test.tsx
    project-view.test.tsx
    auth.test.tsx
    api-client.test.ts
  router.tsx
  main.tsx
  index.css
```

## Auth flow

- Token stored in `localStorage` at key `taskco_token`; user JSON at `taskco_user`.
- `AuthContext` exposes `{ user, token, isAuthenticated, login(token, user), logout() }`.
- `apiFetch` reads `taskco_token` and attaches `Authorization: Bearer <token>`.
- Global 401: `QueryCache`/`MutationCache` `onError` in `main.tsx` clears storage + `window.location.replace('/login')`.
- `ProtectedRoute` checks `isAuthenticated` and redirects to `/login` if false.

## API client

```ts
// src/lib/api-client.ts
apiFetch<T>(path, options?)   // prepends /api, unwraps body.data, throws ApiError on error
```

`ApiError` fields must be declared explicitly (NOT as constructor parameter properties) because `tsconfig` has `erasableSyntaxOnly: true`:

```ts
class ApiError extends Error {
  code: string     // explicit — not `constructor(public code: string)`
  status: number
  ...
}
```

## Query key conventions

| Data | Query key |
|------|-----------|
| Project list | `['projects']` |
| Single project | `['projects', id]` |
| Task list | `['projects', id, 'tasks', filters]` |

Mutations invalidate the relevant keys on success. `useCreateProject` invalidates `['projects']`. `useCreateTask`/`useUpdateTask` invalidate `['projects', id, 'tasks']` and `['projects', id]` (to refresh `taskCount`).

## Design tokens (`src/lib/tokens.ts`)

Use these maps for consistent styling — don't hard-code badge/button classes directly:

```ts
priorityBadge['HIGH' | 'MEDIUM' | 'LOW']   // → Tailwind class string
statusBadge['TODO' | 'IN_PROGRESS' | 'DONE']
button.primary / button.danger
card   // base card class
```

## Patterns

**Per-card mutations** — each `TaskCard` instantiates its own `useUpdateTask` so `isPending` is isolated per card, not shared across all tasks.

**Status toggle** — rendered as a `<select>` with `statusBadge` classes applied; `onChange` fires `useUpdateTask`. `aria-label="Status for <task title>"` for accessibility.

**Filter bar** — tab `<button>` groups with `aria-pressed`, wrapped in `role="group" aria-label="Filter by status/priority"`. Not `<select>` dropdowns.

**Modal** — `role="dialog" aria-modal aria-labelledby`. Closes on backdrop click or mutation success.

## Testing

- **Vitest v4** + **jsdom** + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`
- `globals: true` in `vite.config.ts` test config (required for jest-dom matchers)
- Use `createMemoryRouter` + `RouterProvider` for rendering (not `MemoryRouter`) — React Router v8 requires the data router context for `useNavigate`
- Mock `src/lib/api-client` with a factory that re-declares `ApiError` as a class so `instanceof` checks work in components
- `renderWithRouter(routes, opts)` helper in `src/__tests__/test-utils.tsx`
