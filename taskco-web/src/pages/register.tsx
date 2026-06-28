import { Navigate } from 'react-router'
import { AuthForm } from '../components/auth-form'
import { useAuth } from '../lib/auth-context'

export function RegisterPage() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <AuthForm mode="register" />
}
