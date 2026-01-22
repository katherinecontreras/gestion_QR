import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card.jsx'
import { Input } from '../../components/Input.jsx'
import { supabase, supabaseUrl } from '../../services/supabaseClient.js'

export function RegistroPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('3')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!supabaseUrl) {
        throw new Error('Falta VITE_SUPABASE_URL en .env.local / Vercel env')
      }
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { roleId: Number(roleId) },
        },
      })
      if (err) throw err

      // Queremos forzar el flujo: registrarse -> volver a login con datos precargados
      // (sin exponer contraseña en la URL; solo en state en memoria).
      if (data?.session) {
        await supabase.auth.signOut()
      }

      navigate('/login', {
        replace: true,
        state: {
          prefill: { email, password },
          flash:
            'Registro creado. Tenés que confirmar tu email para poder ingresar. Revisá tu correo y luego iniciá sesión.',
        },
      })
    } catch (e2) {
      const msg =
        e2?.message ??
        (typeof e2 === 'string' ? e2 : null) ??
        'No se pudo registrar'
      const extra = [
        e2?.status ? `status=${e2.status}` : null,
        e2?.code ? `code=${e2.code}` : null,
      ]
        .filter(Boolean)
        .join(' ')
      setError(extra ? `${msg} (${extra})` : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-3">
        <Card
          title="Registro"
          subtitle="Crea tu cuenta y selecciona tu rol (Calidad u Obrero)."
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="new-password"
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
                <option value="2">Calidad</option>
                <option value="3">Obrero</option>
              </select>
              <div className="mt-1 text-xs text-slate-500">
                El rol se guarda en <code>user_metadata.roleId</code> y la DB crea tu perfil automáticamente.
              </div>
            </label>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Creando…' : 'Crear cuenta'}
            </button>
          </form>
        </Card>

        <div className="text-center text-sm text-slate-600">
          ¿Ya tenés cuenta? <Link className="font-medium underline" to="/login">Ingresar</Link>
        </div>
      </div>
    </div>
  )
}

// (diagnóstico removido a pedido)
