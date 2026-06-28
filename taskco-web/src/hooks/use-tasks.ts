import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api-client'
import type { Task } from '../lib/types'
import type { CreateTaskInput } from '../lib/schemas'

export interface TaskFilters {
  status?: string
  priority?: string
}

interface UpdateTaskInput {
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority?: 'HIGH' | 'MEDIUM' | 'LOW'
  title?: string
  description?: string
  dueDate?: string | null
}

export function useTasks(projectId: string, filters: TaskFilters = {}) {
  return useQuery<Task[]>({
    queryKey: ['projects', projectId, 'tasks', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.priority) params.set('priority', filters.priority)
      const qs = params.toString()
      return apiFetch<{ tasks: Task[] }>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`).then(r => r.tasks)
    },
    enabled: !!projectId,
  })
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskInput) =>
      apiFetch<{ task: Task }>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.task),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskInput }) =>
      apiFetch<{ task: Task }>(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then(r => r.task),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}
