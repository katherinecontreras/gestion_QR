import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './services/auth/AuthProvider.jsx'
import { ProtectedRoute } from './middleware/ProtectedRoute.jsx'

import { LoginPage } from './pages/auth/Login.jsx'
import { RegistroPage } from './pages/auth/Registro.jsx'
import { EscannerPage } from './pages/obra/Escanner.jsx'
import { DetallePage } from './pages/obra/Detalle.jsx'
import GestionPage from './pages/gestion/GestionPage.jsx'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/registro', element: <RegistroPage /> },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <ProtectedRoute redirectTo="/login" /> },
      {
        path: 'escanner',
        element: (
          <ProtectedRoute allowedRoleIds={[2, 3]}>
            <EscannerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'detalle/:id',
        element: (
          <ProtectedRoute allowedRoleIds={[2, 3]}>
            <DetallePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'trazabilidad',
        element: (
          <ProtectedRoute allowedRoleIds={[2]}>
            <GestionPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'carga-datos',
        element: (
          <ProtectedRoute allowedRoleIds={[2]}>
            <GestionPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'generar-qr',
        element: (
          <ProtectedRoute allowedRoleIds={[2]}>
            <GestionPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
