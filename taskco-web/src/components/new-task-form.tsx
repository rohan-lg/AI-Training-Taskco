import { useState } from 'react'
import { useCreateTask } from '../hooks/use-tasks'
import { createTaskSchema } from '../lib/schemas'
import { button } from '../lib/tokens'

interface NewTaskFormProps {
  projectId: string
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low priority' },
  { value: 'MEDIUM', label: 'Medium priority' },
  { value: 'HIGH', label: 'High priority' },
] as const

export function NewTaskForm({ projectId }: NewTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [titleError, setTitleError] = useState('')

  const mutation = useCreateTask(projectId)

  function reset() {
    setTitle('')
    setDescription('')
    setPriority('MEDIUM')
    setDueDate('')
    setTitleError('')
    setOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTitleError('')

    const result = createTaskSchema.safeParse({
      title,
      description: description || undefined,
      priority,
      dueDate: dueDate || undefined,
    })

    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'title')
      if (issue) setTitleError(issue.message)
      return
    }

    mutation.mutate(result.data, { onSuccess: reset })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${button.primary} mb-4`}
      >
        + Add Task
      </button>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">New Task</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="task-title" className="sr-only">
            Task title
          </label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleError('') }}
            disabled={mutation.isPending}
            placeholder="Task title *"
            className={`w-full px-3 py-2 rounded-lg border text-gray-900 text-sm
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60
              ${titleError ? 'border-red-500' : 'border-gray-300'}`}
          />
          {titleError && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {titleError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="task-description" className="sr-only">
            Description
          </label>
          <input
            id="task-description"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={mutation.isPending}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <div>
            <label htmlFor="task-priority" className="sr-only">
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={e => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
              disabled={mutation.isPending}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
            >
              {PRIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-due" className="sr-only">
              Due date
            </label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              disabled={mutation.isPending}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-xs text-red-600" role="alert">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Failed to create task'}
          </p>
        )}

        <div className="flex gap-2 items-center">
          <button
            type="submit"
            disabled={mutation.isPending}
            className={`${button.primary} py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {mutation.isPending ? 'Adding…' : 'Add Task'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors
              focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
