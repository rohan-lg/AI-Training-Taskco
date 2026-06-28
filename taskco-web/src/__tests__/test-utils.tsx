import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { RouteObject } from 'react-router'
import { AuthProvider } from '../lib/auth-context'
import type { ReactElement } from 'react'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithRouter(
  routes: RouteObject[],
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  const queryClient = createTestQueryClient()
  const router = createMemoryRouter(routes, { initialEntries })

  function Wrapper({ children }: { children: ReactElement }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }

  render(
    <Wrapper>
      <RouterProvider router={router} />
    </Wrapper>,
  )

  return { queryClient, router }
}

export function setAuthToken(token = 'test-token') {
  localStorage.setItem('taskco_token', token)
  localStorage.setItem(
    'taskco_user',
    JSON.stringify({ id: 'user-1', email: 'test@test.com', name: 'Test User', createdAt: new Date().toISOString() }),
  )
}

export function clearAuth() {
  localStorage.removeItem('taskco_token')
  localStorage.removeItem('taskco_user')
}
