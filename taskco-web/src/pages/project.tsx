import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useProject } from '../hooks/use-project'
import { useTasks, useUpdateTask } from '../hooks/use-tasks'
import { NewTaskForm } from '../components/new-task-form'
import { priorityBadge, statusBadge, card } from '../lib/tokens'
import { ApiError } from '../lib/api-client'
import type { Task } from '../lib/types'

type StatusFilter = '' | 'TODO' | 'IN_PROGRESS' | 'DONE'
type PriorityFilter = '' | 'HIGH' | 'MEDIUM' | 'LOW'

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Todo', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
] as const

const PRIORITY_TABS = [
  { label: 'All', value: '' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
] as const

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

function isOverdue(dueDate: string | null, status: Task['status']): boolean {
  if (!dueDate || status === 'DONE') return false
  return new Date(dueDate) < new Date()
}

interface TaskCardProps {
  task: Task
  projectId: string
}

function TaskCard({ task, projectId }: TaskCardProps) {
  const { mutate: update, isPending } = useUpdateTask(projectId)
  const overdue = isOverdue(task.dueDate, task.status)

  return (
    <div
      className={`${card} shadow-sm transition-shadow hover:shadow-md
        ${overdue ? 'border border-red-300 bg-red-50/40' : 'border border-gray-100'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 shrink">
          <p className="font-medium text-gray-900 leading-snug">{task.title}</p>
          {task.description && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{task.description}</p>
          )}
          {task.dueDate && (
            <p className={`mt-1.5 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {overdue ? '⚠ Overdue · ' : 'Due '}
              {formatDate(task.dueDate)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityBadge[task.priority]}`}
          >
            {task.priority}
          </span>

          <select
            value={task.status}
            onChange={e =>
              update({ taskId: task.id, data: { status: e.target.value as Task['status'] } })
            }
            disabled={isPending}
            aria-label={`Status for ${task.title}`}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 cursor-pointer
              appearance-none text-center focus:outline-none focus-visible:ring-2
              focus-visible:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed
              ${statusBadge[task.status]}`}
          >
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        </div>
      </div>
    </div>
  )
}

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
        <Link
          to="/dashboard"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const project = projectQuery.data!

  return (
    <div>
      <Link
        to="/dashboard"
        className="text-sm text-blue-600 hover:underline mb-4 inline-block
          focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
      >
        ← Dashboard
      </Link>

      {/* Project header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full shrink-0"
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

      {/* New task */}
      <NewTaskForm projectId={id!} />

      {/* Filter bar — tab buttons */}
      <div className="space-y-2 mb-5">
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value as StatusFilter)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                focus-visible:outline-2 focus-visible:outline-blue-500
                ${status === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
              aria-pressed={status === tab.value}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by priority">
          {PRIORITY_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPriority(tab.value as PriorityFilter)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                focus-visible:outline-2 focus-visible:outline-blue-500
                ${priority === tab.value
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
              aria-pressed={priority === tab.value}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {tasksQuery.isLoading && (
        <p className="text-gray-600" role="status">Loading tasks…</p>
      )}

      {tasksQuery.isError && (
        <div className={`${card} border border-red-200`} role="alert">
          <p className="text-red-600">Failed to load tasks.</p>
        </div>
      )}

      {tasksQuery.data && tasksQuery.data.length === 0 && (
        <div className={`${card} text-center py-10`}>
          <p className="text-gray-500">No tasks found.</p>
          {(status || priority) && (
            <button
              type="button"
              onClick={() => { setStatus(''); setPriority('') }}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {tasksQuery.data && tasksQuery.data.length > 0 && (
        <div className="space-y-3">
          {tasksQuery.data.map(task => (
            <TaskCard key={task.id} task={task} projectId={id!} />
          ))}
        </div>
      )}
    </div>
  )
}
