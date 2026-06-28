import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api-client'
import type { ProjectDetail, Task } from '../lib/types'

export function useProject(id: string) {
  return useQuery<ProjectDetail>({
    queryKey: ['projects', id],
    queryFn: () => apiFetch<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  })
}

interface TaskFilters {
  status?: string
  priority?: string
}

export function useTasks(projectId: string, filters: TaskFilters) {
  return useQuery<Task[]>({
    queryKey: ['projects', projectId, 'tasks', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.priority) params.set('priority', filters.priority)
      const qs = params.toString()
      return apiFetch<Task[]>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`)
    },
    enabled: !!projectId,
  })
}
