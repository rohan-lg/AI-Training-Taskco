import { useState } from 'react'
import { useProjects } from '../hooks/use-projects'
import { ProjectCard } from '../components/project-card'
import { NewProjectModal } from '../components/new-project-modal'
import { button, card } from '../lib/tokens'

function SkeletonCard() {
  return (
    <div className={`${card} shadow-sm animate-pulse`}>
      <div className="flex items-start gap-3">
        <div className="w-3 h-3 rounded-full bg-gray-200 mt-1 shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [showModal, setShowModal] = useState(false)
  const { data: projects, isLoading, isError, error } = useProjects()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={button.primary}
        >
          + New Project
        </button>
      </div>

      {isLoading && (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-label="Loading projects"
        >
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {isError && (
        <div className={`${card} border border-red-200`} role="alert">
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Failed to load projects'}
          </p>
        </div>
      )}

      {!isLoading && !isError && projects?.length === 0 && (
        <div className={`${card} text-center py-12`}>
          <div className="text-4xl mb-3" aria-hidden="true">📋</div>
          <p className="text-gray-900 font-semibold text-lg mb-1">No projects yet</p>
          <p className="text-gray-500 text-sm mb-5">Create your first project to get started</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className={button.primary}
          >
            + New Project
          </button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
