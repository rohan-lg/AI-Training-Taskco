import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth-context'
import { ApiError } from './lib/api-client'
import { router } from './router'
import './index.css'

function onGlobalError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    localStorage.removeItem('taskco_token')
    localStorage.removeItem('taskco_user')
    window.location.replace('/login')
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onGlobalError }),
  mutationCache: new MutationCache({ onError: onGlobalError }),
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
