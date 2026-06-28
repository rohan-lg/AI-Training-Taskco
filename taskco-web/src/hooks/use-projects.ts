import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api-client'
import type { Project } from '../lib/types'

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/projects'),
  })
}
