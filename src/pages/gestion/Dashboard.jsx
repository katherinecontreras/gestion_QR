import React, { useEffect, useState } from 'react'
import { Card } from '../../components/Card.jsx'
import { supabase } from '../../services/supabaseClient.js'

export function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ hormigones: 0, canerias: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [{ count: hCount, error: e1 }, { count: cCount, error: e2 }] =
          await Promise.all([
            supabase.from('hormigones').select('*', { count: 'exact', head: true }),
            supabase.from('canerias').select('*', { count: 'exact', head: true }),
          ])
        if (e1) throw e1
        if (e2) throw e2
        if (mounted) setStats({ hormigones: hCount ?? 0, canerias: cCount ?? 0 })
      } catch (e) {
        if (mounted) setError(e?.message ?? 'No se pudo cargar el dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-600">Resumen rápido de trazabilidad.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Registros cargados">
          {loading ? (
            <div className="text-slate-600">Cargando…</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <Stat label="Hormigones" value={stats.hormigones} />
              <Stat label="Cañerías" value={stats.canerias} />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

