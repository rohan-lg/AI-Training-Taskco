# TaskCo Frontend — Step 1: Scaffolding Plan

> Goal: a running **Vite** dev server with **React + TypeScript**, **Tailwind CSS**, **TanStack Query**, and **React Router** installed and configured, served behind a proxy to your Fastify backend. End state: a blank page rendering a styled **“TaskCo”** heading on a gray background, no console errors.

**Package manager:** pnpm (not npm)
**Last updated:** 2026-06-27
**Status:** Step 1 of N — Scaffolding

---

## 0. Architecture note (read first)

This is the **split architecture**: a standalone Vite + React **SPA** that talks to your **separate Fastify backend** over HTTP. This is different from the all-in-one Next.js plan — here the frontend and backend are two independent apps in two directories. The frontend never imports backend code; it only calls the API endpoints in §7.

In dev, the SPA runs on one port and Fastify on another. A **Vite proxy** forwards API calls to Fastify so the browser sees same-origin requests and you avoid CORS entirely (§5).

---

## 1. Versions pinned (June 2026)

| Tool | Package | Version | Role |
|---|---|---|---|
| Build tool | `vite` | 6.x (template default) | Dev server + bundler |
| UI | `react`, `react-dom` | 19.x | Components |
| Language | `typescript` | 5.x | `react-ts` template |
| Styling | `tailwindcss` + `@tailwindcss/vite` | **v4** | Utility CSS via Vite plugin |
| Routing | `react-router` | **v7** (7.14+) | SPA routing, library mode |
| Server state | `@tanstack/react-query` | **v5** | Data fetching/caching |
| React plugin | `@vitejs/plugin-react` | template default | JSX/Fast Refresh |

### ⚠️ Tailwind v4 vs your checklist
Your checklist says “Tailwind needs postcss + tailwind.config.” That describes **Tailwind v3**. The current default install is **v4**, which:
- uses the official **`@tailwindcss/vite`** plugin (no PostCSS config),
- needs **no `tailwind.config.js`** (config is CSS-first via `@theme`),
- replaces `@tailwind base/components/utilities` with a single **`@import "tailwindcss";`**.

This doc uses the v4 path. **All your design tokens are stock utility classes** (`bg-gray-50`, `bg-blue-600`, etc.), so they work identically in v4 — no custom config required. If your lab strictly requires the v3 config file, see **Appendix A** for the v3 path.

---

## 2. Where this lives (project structure)

Place the frontend as a sibling of your Lab 1 Fastify backend. Recommended pnpm-workspace layout:

```
taskco/
├── apps/
│   ├── api/                 # Fastify backend (Lab 1)
│   └── web/                 # ← this Vite frontend
├── pnpm-workspace.yaml
└── package.json             # workspace root (optional)
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
```

> If your Lab 1 used a flat `backend/` + `frontend/` pair instead, keep that — just put this app in `frontend/`. The only hard requirement is that the frontend is its **own** project with its own `package.json`.

---

## 3. Scope guardrails (what we install — and what we don't)

To avoid unbounded scope, Step 1 installs **only** the requested stack. Nothing else.

**Runtime deps:** `react-router`, `@tanstack/react-query`
**Dev deps:** `tailwindcss`, `@tailwindcss/vite` (plus what the template ships: `vite`, `@vitejs/plugin-react`, `typescript`, types)

**Deliberately NOT added in Step 1:**
- ❌ `axios` — the API client uses native `fetch` (zero deps).
- ❌ `zod`, `react-hook-form` — forms come in a later step.
- ❌ component libraries (shadcn, MUI, etc.) — styling is raw Tailwind.
- ❌ state libraries (Redux, Zustand) — TanStack Query handles server state.

If a later step needs one of these, it gets added then, with a reason.

---

## 4. Scaffold commands (pnpm)

From `apps/` (or wherever the frontend should live):

```bash
# 1. Create the Vite app with the React + TypeScript template
pnpm create vite@latest web --template react-ts
cd web

# 2. Install template deps
pnpm install

# 3. Runtime deps
pnpm add react-router @tanstack/react-query

# 4. Tailwind v4 (build-time)
pnpm add -D tailwindcss @tailwindcss/vite

# 5. Run it
pnpm dev
```

> Note on the router package: in **v7** the package is `react-router` and you import from `react-router`. Older guides use `react-router-dom` (v6); that still works as a re-export, but `react-router` is the current path.

---

## 5. Configuration files

### `vite.config.ts` — React plugin, Tailwind plugin, and the API proxy
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173, // frontend dev server
    proxy: {
      // Frontend calls /api/* → forwarded to Fastify, /api prefix stripped.
      // e.g. fetch('/api/auth/login') → http://localhost:3000/auth/login
      '/api': {
        target: 'http://localhost:3000', // ← your Fastify port; change if different
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

**Why this matters:** your API client (§7) uses the base `/api`. The browser only ever talks to `localhost:5173`, so there are **no cross-origin requests and no CORS errors**. The proxy quietly hands them to Fastify on `:3000` and strips the `/api` prefix so the bare paths (`/auth/...`, `/projects/...`, `/tasks/...`) match your backend. Set `target` to whatever port Fastify actually listens on.

### `src/index.css` — the entire Tailwind setup
```css
@import "tailwindcss";
```
That one line is the whole thing in v4. No `@tailwind` directives, no PostCSS file, no content globs.

### `tsconfig` path alias (optional but recommended)
Add to `tsconfig.app.json` `compilerOptions`:
```jsonc
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```
And mirror it in `vite.config.ts` if you want `@/` imports resolved by the bundler (add `resolve.alias`). Skip if you prefer relative imports.

---

## 6. App shell & layout

Target file tree after Step 1:

```
web/
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── package.json
└── src/
    ├── components/
    │   └── layout.tsx        # shared shell wrapper (all pages render inside it)
    ├── pages/
    │   └── home.tsx          # the "TaskCo" heading page
    ├── lib/
    │   ├── api-client.ts     # fetch wrapper, auto-attaches Bearer token
    │   └── tokens.ts         # design-token → class maps
    ├── router.tsx            # route table
    ├── main.tsx              # providers + mount
    └── index.css             # @import "tailwindcss";
```

Naming: files are **kebab-case**, exported identifiers are **PascalCase** for components.

### `src/main.tsx` — mount + providers
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
```

### `src/router.tsx` — route table with the layout as a wrapper
```tsx
import { createBrowserRouter } from 'react-router'
import { Layout } from './components/layout'
import { HomePage } from './pages/home'

export const router = createBrowserRouter([
  {
    element: <Layout />,        // shell wraps every child route
    children: [
      { path: '/', element: <HomePage /> },
      // future: /login, /register, /dashboard, /projects/:id
    ],
  },
])
```

### `src/components/layout.tsx` — the app shell (gray page background)
```tsx
import { Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <span className="text-xl font-semibold text-gray-900">TaskCo</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet /> {/* pages render here */}
      </main>
    </div>
  )
}
```

### `src/pages/home.tsx` — the styled heading (the checkpoint)
```tsx
export function HomePage() {
  return (
    <div className="rounded-lg bg-white p-6">
      <h1 className="text-3xl font-semibold text-gray-900">TaskCo</h1>
      <p className="mt-2 text-gray-600">Frontend scaffold is up and running.</p>
    </div>
  )
}
```

This renders a `bg-gray-50` page, a white card (`rounded-lg`, `p-6`), and a `text-gray-900 font-semibold` heading — already using your tokens, which is the proof Tailwind is live.

---

## 7. Design tokens (your design system — establish now, reuse everywhere)

Reference these exact values in **every** later prompt so Claude stays consistent. (Typos from the source table are corrected to valid Tailwind classes here.)

| Token | Value | Used for |
|---|---|---|
| Page background | `bg-gray-50` | App shell |
| Card background | `bg-white` | Project/task cards, forms |
| Primary button | `bg-blue-600 hover:bg-blue-700 text-white` | Submit, create |
| Danger button | `bg-red-600 hover:bg-red-700 text-white` | Delete |
| Heading text | `text-gray-900 font-semibold` | Titles |
| Body text | `text-gray-600` | Descriptions |
| Border radius | `rounded-lg` | Cards, buttons, inputs |
| Standard padding | `px-4 py-2` | Buttons, inputs |
| Card padding | `p-6` | Card interiors |
| Priority HIGH | `bg-red-100 text-red-800` | Priority badge |
| Priority MEDIUM | `bg-yellow-100 text-yellow-800` | Priority badge |
| Priority LOW | `bg-green-100 text-green-800` | Priority badge |
| Status TODO | `bg-gray-100 text-gray-800` | Status badge |
| Status IN_PROGRESS | `bg-blue-100 text-blue-800` | Status badge |
| Status DONE | `bg-green-100 text-green-800` | Status badge |

### `src/lib/tokens.ts` — tokens as code, so badges never drift
```ts
export const priorityBadge = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
} as const

export const statusBadge = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
} as const

export const button = {
  primary: 'px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white',
  danger: 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white',
} as const

export const card = 'bg-white rounded-lg p-6'
```

---

## 8. API client foundation (token auto-attach)

This seeds Step 2. It uses native `fetch` (no axios), points at the proxy base `/api`, reads the JWT from storage, and unwraps the `{ data }` / `{ error }` envelope your backend returns.

### `src/lib/api-client.ts`
```ts
const BASE_URL = '/api' // proxied to Fastify in dev (see vite.config.ts)

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('taskco_token')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok || body?.error) {
    throw new ApiError(
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? 'Request failed',
      res.status,
    )
  }
  return body.data as T // unwrap the envelope
}
```

**Endpoints it will call (Step 2+), for reference:**

| Method | Path (via client) | Body / query | Returns (`data`) |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, name }` | `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | — (Bearer) | `{ id, email, name, createdAt }` |
| GET | `/projects` | — (Bearer) | `Project[]` |
| POST | `/projects` | `{ name, description, color }` | `Project` |
| GET | `/projects/:id` | — (Bearer) | `Project & { _count: { tasks } }` |
| GET | `/projects/:id/tasks` | `?status=&priority=` | `Task[]` |
| POST | `/projects/:id/tasks` | `{ title, description, status, priority, dueDate }` | `Task` |
| PATCH | `/tasks/:id` | partial task | `Task` |
| DELETE | `/tasks/:id` | — (Bearer) | `{ id }` |

JWT pattern: token is saved to `localStorage` after login and attached as `Authorization: Bearer <token>` automatically by `apiFetch` on every call.

---

## 9. Self-review checklist (verify before moving on)

- [ ] `pnpm dev` starts with **no errors** and serves at `http://localhost:5173`.
- [ ] Browser shows a **styled “TaskCo” heading on a gray (`bg-gray-50`) background**.
- [ ] Tailwind is actually working — utility classes produce real styles (the white card and gray page are visible, not unstyled text). Sanity check: temporarily add `bg-gray-50` somewhere and confirm it renders.
- [ ] `react-router` and `@tanstack/react-query` appear in `package.json` **dependencies**.
- [ ] `tailwindcss` and `@tailwindcss/vite` appear in **devDependencies**.
- [ ] **No console errors.**
- [ ] The project structure is understandable (Trap #5): just `components/`, `pages/`, `lib/`, plus `router.tsx` / `main.tsx` — nothing exotic.
- [ ] **No unrequested packages** were added (Trap #10): no axios, no UI kit, no state lib. Native `fetch` only.

### ✅ Checkpoint
Browser shows a styled **“TaskCo”** heading on a gray background. No console errors. `pnpm dev` runs clean.

---

## 10. What's next (preview, not part of Step 1)

- **Step 2:** wire `apiFetch` into TanStack Query hooks; build Login/Register against `/auth/*`; persist the token.
- **Step 3:** Dashboard — `GET /projects` with task counts, project cards.
- **Step 4:** Project view — tasks with status/priority filters, badges (using `tokens.ts`), due dates, inline status toggle.
- **Step 5:** 404 + error states.

---

## Appendix A — Tailwind **v3** path (only if your lab requires the config file)

Use this instead of §5's Tailwind setup if you must have `tailwind.config.js` + PostCSS:

```bash
pnpm add -D tailwindcss@3 postcss autoprefixer
pnpm dlx tailwindcss init -p     # creates tailwind.config.js + postcss.config.js
```

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

`src/index.css` (v3 directives):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Then **remove** `@tailwindcss/vite` from `vite.config.ts` (v3 uses PostCSS, not the Vite plugin). Everything else in this doc (proxy, router, tokens, API client) is unchanged. Don't mix v3 and v4 — pick one.

---

## Appendix B — Conventions cheat sheet

- **Files:** kebab-case (`api-client.ts`, `layout.tsx`). **Components/types:** PascalCase. **Vars/functions:** camelCase.
- **API base:** always `/api` in the client; the Vite proxy maps it to Fastify in dev.
- **Tokens:** import class strings from `lib/tokens.ts`; never hardcode badge colors inline.
- **Server state:** TanStack Query only. No Redux/Zustand.
- **HTTP:** native `fetch` via `apiFetch`; it attaches the Bearer token for you.