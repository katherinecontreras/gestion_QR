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
import { TrazabilidadPage } from './pages/gestion/Trazabilidad.jsx'
import { CargaDatosPage } from './pages/gestion/CargaDatos.jsx'
import { GenerarQrPage } from './pages/gestion/GenerarQr.jsx'

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
            <TrazabilidadPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'carga-datos',
        element: (
          <ProtectedRoute allowedRoleIds={[2]}>
            <CargaDatosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'generar-qr',
        element: (
          <ProtectedRoute allowedRoleIds={[2]}>
            <GenerarQrPage />
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
