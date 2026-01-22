import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth/useAuth.js'
import { ROLE_IDS } from '../services/auth/roles.js'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'px-3 py-2 rounded-lg text-sm font-medium transition',
          isActive
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}

export function AppLayout({ children }) {
  const navigate = useNavigate()
  const { user, roleId, roleName, signOut } = useAuth()

  const showGestion = roleId === ROLE_IDS.CALIDAD

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link to="/escanner" className="font-semibold tracking-tight">
            Gestión de QRs
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            <NavItem to="/escanner">Escáner</NavItem>
            {showGestion && <NavItem to="/dashboard">Dashboard</NavItem>}
            {showGestion && <NavItem to="/carga-datos">Carga Excel</NavItem>}
            {showGestion && <NavItem to="/generar-qr">Generar QR</NavItem>}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:block text-right">
                  <div className="text-xs text-slate-500">Sesión</div>
                  <div className="text-sm font-medium leading-tight">
                    {user.email}
                  </div>
                  <div className="text-xs text-slate-500">
                    {roleName ? roleName : roleId ? `Rol ${roleId}` : 'Sin rol'}
                  </div>
                </div>
                <button
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
                  onClick={async () => {
                    await signOut()
                    navigate('/login', { replace: true })
                  }}
                >
                  Salir
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}

