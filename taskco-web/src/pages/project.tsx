import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useProject, useTasks } from '../hooks/use-project'
import { priorityBadge, statusBadge, card } from '../lib/tokens'
import { ApiError } from '../lib/api-client'
import type { Task } from '../lib/types'

type StatusFilter = '' | 'TODO' | 'IN_PROGRESS' | 'DONE'
type PriorityFilter = '' | 'HIGH' | 'MEDIUM' | 'LOW'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [status, setStatus] = useState<StatusFilter>('')
  const [priority, setPriority] = useState<PriorityFilter>('')

  const projectQuery = useProject(id ?? '')
  const tasksQuery = useTasks(id ?? '', {
    status: status || undefined,
    priority: priority || undefined,
  })

  if (projectQuery.isLoading) {
    return <p className="text-gray-600" role="status">Loading project…</p>
  }

  if (projectQuery.isError) {
    const is404 = projectQuery.error instanceof ApiError && projectQuery.error.status === 404
    return (
      <div className={`${card} border border-red-200`} role="alert">
        <p className="text-red-600">
          {is404 ? 'Project not found.' : 'Failed to load project.'}
        </p>
        <Link to="/dashboard" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const project = projectQuery.data!

  return (
    <div>
      <Link to="/dashboard" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Dashboard
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.color }}
            aria-hidden="true"
          />
          <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
        </div>
        {project.description && (
          <p className="mt-2 text-gray-600">{project.description}</p>
        )}
        <p className="mt-1 text-sm text-gray-400">
          {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={status}
          onChange={e => setStatus(e.target.value as StatusFilter)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
        </select>

        <select
          value={priority}
          onChange={e => setPriority(e.target.value as PriorityFilter)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {tasksQuery.isLoading && (
        <p className="text-gray-600" role="status">Loading tasks…</p>
      )}

      {tasksQuery.isError && (
        <div className={`${card} border border-red-200`} role="alert">
          <p className="text-red-600">Failed to load tasks.</p>
        </div>
      )}

      {tasksQuery.data && tasksQuery.data.length === 0 && (
        <div className={`${card} text-center`}>
          <p className="text-gray-600">No tasks found.</p>
        </div>
      )}

      {tasksQuery.data && tasksQuery.data.length > 0 && (
        <div className="space-y-3">
          {tasksQuery.data.map((task: Task) => (
            <div key={task.id} className={card}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{task.title}</p>
                  {task.description && (
                    <p className="mt-1 text-sm text-gray-600">{task.description}</p>
                  )}
                  {task.dueDate && (
                    <p className="mt-1 text-xs text-gray-400">
                      Due {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${statusBadge[task.status]}`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${priorityBadge[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
