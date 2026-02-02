import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card.jsx'
import { Input } from '../../components/Input.jsx'
import { useAuth } from '../../services/auth/useAuth.js'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signInWithPassword } = useAuth()
  const from = location.state?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate(from ?? '/escanner', { replace: true })
  }, [user, navigate, from])

  useEffect(() => {
    const prefill = location.state?.prefill
    const msg = location.state?.flash
    if (prefill?.email) setEmail(prefill.email)
    if (prefill?.password) setPassword(prefill.password)
    if (msg) setFlash(msg)
    // limpia el state para evitar que el mensaje quede “pegado” en refresh/back
    if (prefill || msg) {
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setFlash('')
    setLoading(true)
    try {
      const { error: err } = await signInWithPassword({ email, password })
      if (err) throw err
      const to = location.state?.from ?? '/escanner'
      navigate(to, { replace: true })
    } catch (e2) {
      setError(e2?.message ?? 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <Card
          title="Ingresar"
          subtitle="Accedé con tu usuario de Supabase (Auth)."
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              required
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {flash && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {flash}
              </div>
            )}

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
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>

            <p className="text-xs text-slate-500">
              Si iniciás sesión pero quedás “sin rol”, verificá que exista la fila en
              <code className="px-1">perfiles</code> y su <code className="px-1">id_rol</code>.
            </p>

            <div className="text-sm text-slate-600">
              ¿No tenés cuenta?{' '}
              <Link className="font-medium underline" to="/registro">
                Registrate
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

