import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api-client'
import type { ProjectDetail } from '../lib/types'

export function useProject(id: string) {
  return useQuery<ProjectDetail>({
    queryKey: ['projects', id],
    queryFn: () =>
      apiFetch<{ project: ProjectDetail }>(`/projects/${id}`).then(r => r.project),
    enabled: !!id,
  })
}
