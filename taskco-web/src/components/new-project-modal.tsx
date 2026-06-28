import { useState } from 'react'
import { useCreateProject } from '../hooks/use-projects'
import { createProjectSchema } from '../lib/schemas'
import { button } from '../lib/tokens'

const PRESET_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#64748b',
]

interface NewProjectModalProps {
  onClose: () => void
}

export function NewProjectModal({ onClose }: NewProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [nameError, setNameError] = useState('')

  const mutation = useCreateProject()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameError('')

    const result = createProjectSchema.safeParse({
      name,
      description: description || undefined,
      color,
    })

    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'name')
      if (issue) setNameError(issue.message)
      return
    }

    mutation.mutate(result.data, { onSuccess: onClose })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            New Project
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="proj-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="proj-name"
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
              disabled={mutation.isPending}
              placeholder="My Project"
              className={`w-full px-4 py-2 rounded-lg border text-gray-900 focus:outline-none
                focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60
                ${nameError ? 'border-red-500' : 'border-gray-300'}`}
            />
            {nameError && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {nameError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="proj-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="proj-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
              placeholder="What's this project about?"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-900
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                disabled:opacity-60 resize-none"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Color</span>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Select color ${c}`}
                  aria-pressed={color === c}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800
                    ${color === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''}`}
                />
              ))}
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Failed to create project'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700
                hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={`flex-1 ${button.primary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {mutation.isPending ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
