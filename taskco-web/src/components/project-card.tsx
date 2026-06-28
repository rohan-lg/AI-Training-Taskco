import { Link } from 'react-router'
import { card } from '../lib/tokens'
import type { Project } from '../lib/types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className={`block ${card} hover:shadow-md transition-shadow border border-gray-100`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: project.color }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{project.name}</h2>
          {project.description && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{project.description}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Link>
  )
}
