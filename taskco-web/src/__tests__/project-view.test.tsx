import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectPage } from '../pages/project'
import { ProtectedRoute } from '../components/protected-route'
import { renderWithRouter, setAuthToken, clearAuth } from './test-utils'
import type { ProjectDetail, Task } from '../lib/types'

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

import { apiFetch, ApiError } from '../lib/api-client'
const mockApiFetch = vi.mocked(apiFetch)

const FAKE_PROJECT: ProjectDetail = {
  id: 'proj-1',
  name: 'My Project',
  description: 'A great project',
  color: '#3b82f6',
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  taskCount: 3,
}

const FAKE_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Fix login bug',
    description: 'The login page crashes on mobile',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: '2024-12-31T00:00:00.000Z',
    projectId: 'proj-1',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'task-2',
    title: 'Write docs',
    description: null,
    status: 'TODO',
    priority: 'LOW',
    dueDate: null,
    projectId: 'proj-1',
    createdAt: '2024-01-02T00:00:00.000Z',
  },
]

function setup(projectId = 'proj-1') {
  setAuthToken()
  return renderWithRouter(
    [
      { path: '/dashboard', element: <div data-testid="dashboard-page">Dashboard</div> },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/projects/:id', element: <ProjectPage /> }],
      },
    ],
    { initialEntries: [`/projects/${projectId}`] },
  )
}

beforeEach(() => {
  clearAuth()
  vi.clearAllMocks()
})

describe('ProjectPage', () => {
  it('shows loading state while fetching project', async () => {
    mockApiFetch.mockReturnValueOnce(new Promise(() => {})) // never resolves
    setup()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading project…')
  })

  it('renders project name in the header', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)

    setup()
    expect(await screen.findByRole('heading', { name: 'My Project' })).toBeInTheDocument()
  })

  it('renders project description', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)

    setup()
    await screen.findByRole('heading', { name: 'My Project' })
    expect(screen.getByText('A great project')).toBeInTheDocument()
  })

  it('shows the task count from the project', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)

    setup()
    await screen.findByRole('heading', { name: 'My Project' })
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('renders task titles in the task list', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)

    setup()
    expect(await screen.findByText('Fix login bug')).toBeInTheDocument()
    expect(screen.getByText('Write docs')).toBeInTheDocument()
  })

  it('renders status and priority badges on tasks', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)

    setup()
    await screen.findByText('Fix login bug')
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })

  it('shows empty state when no tasks exist', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce([])

    setup()
    expect(await screen.findByText('No tasks found.')).toBeInTheDocument()
  })

  it('shows 404 error message when project is not found', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('NOT_FOUND', 'Not found', 404))

    setup()
    expect(await screen.findByText('Project not found.')).toBeInTheDocument()
  })

  it('shows generic error when project fetch fails with non-404 error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('INTERNAL', 'Server error', 500))

    setup()
    expect(await screen.findByText('Failed to load project.')).toBeInTheDocument()
  })

  it('shows a link back to /dashboard', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce([])

    setup()
    await screen.findByRole('heading', { name: 'My Project' })
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
  })

  it('renders status filter dropdown', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)

    setup()
    await screen.findByRole('heading', { name: 'My Project' })
    expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument()
  })

  it('renders priority filter dropdown', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)

    setup()
    await screen.findByRole('heading', { name: 'My Project' })
    expect(screen.getByRole('combobox', { name: /filter by priority/i })).toBeInTheDocument()
  })

  it('triggers a new task fetch when status filter changes', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)
      .mockResolvedValueOnce([]) // second tasks fetch after filter change

    setup()
    await screen.findByRole('heading', { name: 'My Project' })

    const statusFilter = screen.getByRole('combobox', { name: /filter by status/i })
    await userEvent.selectOptions(statusFilter, 'TODO')

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/projects/proj-1/tasks?status=TODO')
    })
  })

  it('triggers a new task fetch when priority filter changes', async () => {
    mockApiFetch
      .mockResolvedValueOnce(FAKE_PROJECT)
      .mockResolvedValueOnce(FAKE_TASKS)
      .mockResolvedValueOnce([])

    setup()
    await screen.findByRole('heading', { name: 'My Project' })

    const priorityFilter = screen.getByRole('combobox', { name: /filter by priority/i })
    await userEvent.selectOptions(priorityFilter, 'HIGH')

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/projects/proj-1/tasks?priority=HIGH')
    })
  })
})
