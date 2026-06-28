export const priorityBadge = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
} as const

export const statusBadge = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
} as const

export const button = {
  primary: 'px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors',
  danger: 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors',
} as const

export const card = 'bg-white rounded-lg p-6'
