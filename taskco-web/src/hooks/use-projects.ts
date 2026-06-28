import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api-client'
import type { Project } from '../lib/types'
import type { CreateProjectInput } from '../lib/schemas'

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () =>
      apiFetch<{ projects: Project[] }>('/projects').then(r => r.projects),
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectInput) =>
      apiFetch<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.project),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
