import { useProjects } from '../hooks/use-projects'
import { ProjectCard } from '../components/project-card'
import { card } from '../lib/tokens'

export function DashboardPage() {
  const { data: projects, isLoading, isError, error } = useProjects()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Projects</h1>

      {isLoading && (
        <p className="text-gray-600" role="status">
          Loading projects…
        </p>
      )}

      {isError && (
        <div className={`${card} border border-red-200`} role="alert">
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Failed to load projects'}
          </p>
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className={`${card} text-center`}>
          <p className="text-gray-600">No projects yet.</p>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
