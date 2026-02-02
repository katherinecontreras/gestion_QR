import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../services/auth/useAuth.js'

export function ProtectedRoute({
  allowedRoleIds,
  redirectTo = '/escanner',
  children,
}) {
  const { loading, user, roleId } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-slate-600">
        Cargando…
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search ?? ''}${location.hash ?? ''}` }}
      />
    )
  }

  if (Array.isArray(allowedRoleIds) && allowedRoleIds.length > 0) {
    if (!roleId || !allowedRoleIds.includes(roleId)) {
      return <Navigate to={redirectTo} replace />
    }
  }

  // Permite usar el componente como "gate" sin children:
  // <ProtectedRoute /> como index route
  if (!children) return <Navigate to="/escanner" replace />

  return children
}

