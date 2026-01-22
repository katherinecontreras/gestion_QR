import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scanner, useDevices } from '@yudiel/react-qr-scanner'
import { Card } from '../../components/Card.jsx'

function parseToRoute(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null

  // Si es URL, extrae pathname
  try {
    const u = new URL(trimmed)
    if (u.pathname?.startsWith('/detalle/')) {
      return `${u.pathname}${u.search}`
    }
  } catch {
    // no-op
  }

  // Si viene solo el UUID, asumimos /detalle/:id
  return `/detalle/${encodeURIComponent(trimmed)}`
}

export function EscannerPage() {
  const navigate = useNavigate()
  const devices = useDevices()
  const [deviceId, setDeviceId] = useState('')
  const [last, setLast] = useState('')
  const [error, setError] = useState('')

  const constraints = useMemo(() => {
    if (deviceId) return { deviceId }
    // en móvil tiende a usar trasera
    return { facingMode: 'environment' }
  }, [deviceId])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Escáner</h1>
          <p className="text-sm text-slate-600">
            Apuntá al QR para abrir el detalle y descargar documentación.
          </p>
        </div>

        <label className="text-sm">
          <div className="text-xs font-medium text-slate-600">Cámara</div>
          <select
            className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">Automática</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Cámara ${d.deviceId}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card
        title="Cámara"
        subtitle="Optimizado para móvil (facingMode: environment cuando aplica)."
      >
        <div className="rounded-2xl overflow-hidden border bg-black">
          <Scanner
            constraints={constraints}
            onError={(e) => setError(e?.message ?? 'Error de cámara')}
            onScan={(detectedCodes) => {
              const raw = detectedCodes?.[0]?.rawValue
              if (!raw) return
              if (raw === last) return
              setLast(raw)
              const route = parseToRoute(raw)
              if (route) navigate(route)
            }}
          />
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {last && (
          <div className="mt-3 text-xs text-slate-500 break-all">
            Último QR: <span className="font-mono">{last}</span>
          </div>
        )}
      </Card>
    </div>
  )
}

