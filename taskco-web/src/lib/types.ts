export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  ownerId: string
  createdAt: string
}

export interface ProjectDetail extends Project {
  taskCount: number
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  dueDate: string | null
  projectId: string
  createdAt: string
}
