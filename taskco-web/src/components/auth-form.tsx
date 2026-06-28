import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { apiFetch, ApiError } from '../lib/api-client'
import { useAuth } from '../lib/auth-context'
import { loginSchema, registerSchema } from '../lib/schemas'
import { button, card } from '../lib/tokens'
import type { User } from '../lib/types'

type Mode = 'login' | 'register'

interface FieldErrors {
  name?: string
  email?: string
  password?: string
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
    setServerError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const schema = mode === 'login' ? loginSchema : registerSchema
    const raw = mode === 'login' ? { email, password } : { name, email, password }
    const result = schema.safeParse(raw)

    if (!result.success) {
      const errs: FieldErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors
        if (!errs[key]) errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(result.data),
        })
        login(data.token, data.user)
        void navigate('/dashboard')
      } else {
        await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify(result.data),
        })
        void navigate('/login')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setServerError('An account with this email already exists.')
        } else {
          setServerError(err.message)
        }
      } else {
        setServerError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className={card}>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => { setName(e.target.value); clearFieldError('name') }}
                disabled={loading}
                className={`w-full px-4 py-2 rounded-lg border text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:bg-gray-50 disabled:opacity-60
                  ${fieldErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              />
              {fieldErrors.name && (
                <p id="name-error" role="alert" className="mt-1 text-sm text-red-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); clearFieldError('email') }}
              disabled={loading}
              className={`w-full px-4 py-2 rounded-lg border text-gray-900 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:bg-gray-50 disabled:opacity-60
                ${fieldErrors.email ? 'border-red-500' : 'border-gray-300'}`}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
              disabled={loading}
              className={`w-full px-4 py-2 rounded-lg border text-gray-900 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:bg-gray-50 disabled:opacity-60
                ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'}`}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="mt-1 text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="text-sm text-red-600">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${button.primary} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600 text-center">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
