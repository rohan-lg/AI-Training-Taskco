import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { DashboardPage } from '../pages/dashboard'
import { ProtectedRoute } from '../components/protected-route'
import { renderWithRouter, setAuthToken, clearAuth } from './test-utils'
import type { Project } from '../lib/types'

vi.mock('../lib/api-client', () => {
  class ApiError extends Error {
    code: string
    status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.code = code
      this.status = status
    }
  }
  return { apiFetch: vi.fn(), ApiError }
})

import { apiFetch } from '../lib/api-client'
const mockApiFetch = vi.mocked(apiFetch)

const FAKE_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Alpha Project',
    description: 'First project description',
    color: '#3b82f6',
    ownerId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'proj-2',
    name: 'Beta Project',
    description: null,
    color: '#ef4444',
    ownerId: 'user-1',
    createdAt: '2024-02-01T00:00:00.000Z',
  },
]

function setup(authenticated = true) {
  if (authenticated) setAuthToken()
  return renderWithRouter(
    [
      { path: '/login', element: <div data-testid="login-page">Login</div> },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', element: <DashboardPage /> }],
      },
    ],
    { initialEntries: ['/dashboard'] },
  )
}

beforeEach(() => {
  clearAuth()
  vi.clearAllMocks()
})

describe('DashboardPage', () => {
  it('shows loading state while fetching projects', async () => {
    mockApiFetch.mockReturnValueOnce(new Promise(() => {})) // never resolves
    setup()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading projects…')
  })

  it('renders a project card for each project returned', async () => {
    mockApiFetch.mockResolvedValueOnce(FAKE_PROJECTS)
    setup()
    expect(await screen.findByText('Alpha Project')).toBeInTheDocument()
    expect(screen.getByText('Beta Project')).toBeInTheDocument()
  })

  it('shows project description when present', async () => {
    mockApiFetch.mockResolvedValueOnce(FAKE_PROJECTS)
    setup()
    expect(await screen.findByText('First project description')).toBeInTheDocument()
  })

  it('renders project cards as links to /projects/:id', async () => {
    mockApiFetch.mockResolvedValueOnce(FAKE_PROJECTS)
    setup()
    await screen.findByText('Alpha Project')
    const link = screen.getByRole('link', { name: /alpha project/i })
    expect(link).toHaveAttribute('href', '/projects/proj-1')
  })

  it('shows empty state when no projects exist', async () => {
    mockApiFetch.mockResolvedValueOnce([])
    setup()
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Request failed'))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed')
  })

  it('redirects unauthenticated users to /login', async () => {
    setup(false) // no auth
    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
  })

  it('calls GET /projects endpoint', async () => {
    mockApiFetch.mockResolvedValueOnce([])
    setup()
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/projects')
    })
  })

  it('renders the page heading "Projects"', async () => {
    mockApiFetch.mockResolvedValueOnce([])
    setup()
    await screen.findByText('No projects yet.')
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })
})
