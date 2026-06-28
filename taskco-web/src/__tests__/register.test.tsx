import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterPage } from '../pages/register'
import { renderWithRouter, clearAuth } from './test-utils'

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
      { path: '/register', element: <RegisterPage /> },
      { path: '/login', element: <div data-testid="login-page">Login</div> },
      { path: '/dashboard', element: <div data-testid="dashboard-page">Dashboard</div> },
    ],
    { initialEntries: ['/register'] },
  )
}

beforeEach(() => {
  clearAuth()
  vi.clearAllMocks()
})

describe('RegisterPage', () => {
  it('renders name, email, password inputs and submit button', () => {
    setup()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('renders a link to the login page', () => {
    setup()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows name required error when name is empty', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
  })

  it('shows email required error when email is empty', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
  })

  it('shows invalid email error when email format is wrong', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'bad-email')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Invalid email address')).toBeInTheDocument()
  })

  it('shows password too short error when password < 8 chars', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('shows password required error when password is completely empty', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('does not call apiFetch when validation fails', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await screen.findByText('Name is required')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('calls apiFetch with correct payload on valid submit', async () => {
    mockApiFetch.mockResolvedValueOnce({
      token: 'jwt',
      user: { id: '1', email: 'alice@example.com', name: 'Alice', createdAt: '2024-01-01' },
    })

    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', password: 'password123' }),
      })
    })
  })

  it('navigates to /login after successful registration', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined)

    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
  })

  it('shows "email already exists" on 409 CONFLICT', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('CONFLICT', 'Email taken', 409))

    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists.',
    )
  })

  it('shows server error message on 400 VALIDATION_ERROR', async () => {
    mockApiFetch.mockRejectedValueOnce(
      new ApiError('VALIDATION_ERROR', 'Invalid input', 400),
    )

    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid input')
  })

  it('shows generic error on unexpected exception', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network failure'))

    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })

  it('disables inputs and button during submission', async () => {
    let resolve!: (value: unknown) => void
    mockApiFetch.mockReturnValueOnce(new Promise(r => { resolve = r }))

    setup()
    await userEvent.type(screen.getByLabelText('Name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()
    expect(screen.getByRole('button', { name: /please wait/i })).toBeDisabled()

    resolve(undefined)
  })

  it('clears field error when user starts typing again', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name'), 'A')
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
  })
})
