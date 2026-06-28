import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from '../pages/login'
import { renderWithRouter, clearAuth } from './test-utils'

// Manual mock: keeps ApiError as a real class for instanceof checks
vi.mock('../lib/api-client', () => {
  class ApiError extends Error {
    code: string
    status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.code = code
      this.status = status
    }
  }
  return { apiFetch: vi.fn(), ApiError }
})

import { apiFetch, ApiError } from '../lib/api-client'
const mockApiFetch = vi.mocked(apiFetch)

function setup() {
  return renderWithRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <div>Register Page</div> },
      { path: '/dashboard', element: <div data-testid="dashboard-page">Dashboard</div> },
    ],
    { initialEntries: ['/login'] },
  )
}

beforeEach(() => {
  clearAuth()
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders email input, password input, and sign-in button', () => {
    setup()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders a link to the register page', () => {
    setup()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })

  it('shows email required error when email is empty and form is submitted', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
  })

  it('shows invalid email error when email format is wrong', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Invalid email address')).toBeInTheDocument()
  })

  it('shows password required error when password is empty', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Password is required')).toBeInTheDocument()
  })

  it('does not call apiFetch when validation fails', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await screen.findByText('Email is required')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('clears field error when user starts typing again', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'a')
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
  })

  it('calls apiFetch with correct payload on valid submit', async () => {
    mockApiFetch.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', name: 'Test', createdAt: '2024-01-01' },
    })

    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      })
    })
  })

  it('navigates to /dashboard after successful login', async () => {
    mockApiFetch.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', name: 'Test', createdAt: '2024-01-01' },
    })

    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('stores token in localStorage after successful login', async () => {
    mockApiFetch.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', name: 'Test', createdAt: '2024-01-01' },
    })

    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(localStorage.getItem('taskco_token')).toBe('jwt-token')
    })
  })

  it('shows server error message on 401 UNAUTHORIZED', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 'Invalid email or password', 401))

    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('shows "email already exists" message on 409 CONFLICT', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('CONFLICT', 'Email taken', 409))

    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists.',
    )
  })

  it('shows generic error on unexpected exception', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network failure'))

    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })

  it('disables inputs and button during submission', async () => {
    let resolve!: (value: unknown) => void
    mockApiFetch.mockReturnValueOnce(new Promise(r => { resolve = r }))

    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()
    expect(screen.getByRole('button', { name: /please wait/i })).toBeDisabled()

    resolve({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', name: 'Test', createdAt: '2024-01-01' },
    })
  })
})
