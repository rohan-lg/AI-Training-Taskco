import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './components/layout'
import { ProtectedRoute } from './components/protected-route'
import { HomePage } from './pages/home'
import { LoginPage } from './pages/login'
import { RegisterPage } from './pages/register'
import { DashboardPage } from './pages/dashboard'
import { ProjectPage } from './pages/project'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/home', element: <HomePage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/projects/:id', element: <ProjectPage /> },
        ],
      },
    ],
  },
])
