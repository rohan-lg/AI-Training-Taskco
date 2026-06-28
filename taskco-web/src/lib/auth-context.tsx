import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from './types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('taskco_token'),
  )
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('taskco_user')
    return stored ? (JSON.parse(stored) as User) : null
  })

  function login(newToken: string, newUser: User) {
    localStorage.setItem('taskco_token', newToken)
    localStorage.setItem('taskco_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  function logout() {
    localStorage.removeItem('taskco_token')
    localStorage.removeItem('taskco_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
