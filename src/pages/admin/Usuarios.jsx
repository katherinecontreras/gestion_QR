import React, { useState } from 'react'
import { Card } from '../../components/Card.jsx'
import { Input } from '../../components/Input.jsx'
import { ROLE_IDS } from '../../services/auth/roles.js'
import { adminCreateUser } from '../../services/admin/users.js'

export function UsuariosAdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState(String(ROLE_IDS.OBRERO))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    setLoading(true)
    try {
      await adminCreateUser({ email, password, roleId: Number(roleId) })
      setOk('Usuario creado. Verifica en Supabase Auth y en la tabla perfiles.')
      setEmail('')
      setPassword('')
      setRoleId(String(ROLE_IDS.OBRERO))
    } catch (e2) {
      setError(e2?.message ?? 'No se pudo crear el usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Admin · Usuarios</h1>
        <p className="text-sm text-slate-600">
          Crea usuarios vía Edge Function (recomendado) usando <code>service_role_key</code>.
        </p>
      </div>

      <Card
        title="Crear usuario"
        subtitle="Requiere una Edge Function llamada create-user (ver README)."
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="block">
            <div className="text-sm font-medium text-slate-700">Rol</div>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value={String(ROLE_IDS.ADMIN)}>Admin</option>
              <option value={String(ROLE_IDS.CALIDAD)}>Calidad</option>
              <option value={String(ROLE_IDS.OBRERO)}>Obrero</option>
            </select>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {ok && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {ok}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </Card>

      <Card title="Nota de seguridad" subtitle="Importante para producción">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>
            No expongas <code>service_role_key</code> en el frontend.
          </li>
          <li>
            La Edge Function debe validar que el caller sea <b>Admin</b> (por JWT + perfil).
          </li>
          <li>
            Agrega RLS en tablas y policies en Storage para bloquear escritura a Obrero.
          </li>
        </ul>
      </Card>
    </div>
  )
}

