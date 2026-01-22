import React, { useMemo, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Card } from '../../components/Card.jsx'
import { Input } from '../../components/Input.jsx'
import {
  buildQrPayload,
  saveQrPayload,
  searchCanerias,
  searchHormigones,
  TIPOS,
} from '../../services/db/records.js'

function downloadCanvas(canvas, filename) {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export function GenerarQrPage() {
  const [tipo, setTipo] = useState(TIPOS.HORMIGONES)
  const [q1, setQ1] = useState('') // titulo o nro_linea
  const [q2, setQ2] = useState('') // nro_interno o nro_iso
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  const [selected, setSelected] = useState(null) // { tipo, id, label, archivo_url }
  const qrPayload = useMemo(() => {
    if (!selected?.id || !selected?.tipo) return ''
    return buildQrPayload({ id: selected.id, tipo: selected.tipo })
  }, [selected])
  const canvasRef = useRef(null)

  const labels = useMemo(() => {
    if (tipo === TIPOS.CANERIAS) {
      return {
        t: 'Cañería',
        a: 'Nro línea',
        b: 'Nro ISO',
        hint: 'Busca por Nro Línea y/o Nro ISO',
      }
    }
    return {
      t: 'Hormigón',
      a: 'Título (nombre)',
      b: 'Nro interno',
      hint: 'Busca por Título y/o Nro interno',
    }
  }, [tipo])

  async function onSearch() {
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      if (tipo === TIPOS.CANERIAS) {
        const res = await searchCanerias({ nroLinea: q1, nroIso: q2 })
        setItems(res)
      } else {
        const res = await searchHormigones({ titulo: q1, nroInterno: q2 })
        setItems(res)
      }
    } catch (e) {
      setError(e?.message ?? 'No se pudo buscar')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function onGenerate(item) {
    setError('')
    const id = tipo === TIPOS.CANERIAS ? item.id_caneria : item.id_hormigon
    const label =
      tipo === TIPOS.CANERIAS
        ? `${item.nro_linea} / ${item.nro_iso}`
        : `${item.titulo} / ${item.nro_interno}`

    const archivo_url = item.archivo_url
    setSelected({ tipo, id, label, archivo_url })

    // Guardamos el payload para trazabilidad (campo existente: qr_code_url)
    try {
      const payload = buildQrPayload({ id, tipo })
      await saveQrPayload({ tipo, id, qrPayload: payload })
    } catch (e) {
      setError(
        e?.message ??
          'Se generó el QR pero no se pudo guardar en la DB (revisar permisos/RLS).',
      )
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Generar QR</h1>
        <p className="text-sm text-slate-600">
          Busca un registro y genera un QR que apunta a <code>/detalle/:id</code>.
        </p>
      </div>

      <Card title="1) Buscar" subtitle={labels.hint}>
        <div className="grid gap-3">
          <label className="text-sm">
            <div className="text-xs font-medium text-slate-600">Tipo</div>
            <select
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value)
                setItems([])
                setSelected(null)
                setError('')
              }}
            >
              <option value={TIPOS.HORMIGONES}>Hormigón</option>
              <option value={TIPOS.CANERIAS}>Cañería</option>
            </select>
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <Input label={labels.a} value={q1} onChange={(e) => setQ1(e.target.value)} />
            <Input label={labels.b} value={q2} onChange={(e) => setQ2(e.target.value)} />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={onSearch}
              disabled={loading}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="2) Resultados"
        subtitle={items.length ? `Coincidencias: ${items.length}` : 'Sin resultados'}
      >
        {items.length === 0 ? (
          <div className="text-slate-600">—</div>
        ) : (
          <div className="divide-y">
            {items.map((item) => {
              const id = tipo === TIPOS.CANERIAS ? item.id_caneria : item.id_hormigon
              const label =
                tipo === TIPOS.CANERIAS
                  ? `${item.nro_linea} / ${item.nro_iso}`
                  : `${item.titulo} / ${item.nro_interno}`
              const hasFile = Boolean(item.archivo_url)
              return (
                <div key={id} className="py-3 flex gap-3 items-center">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{label}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{id}</div>
                    <div className="text-xs text-slate-500">
                      Archivo: {hasFile ? '✅ vinculado' : '❌ no vinculado'}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <button
                      onClick={() => onGenerate(item)}
                      className="rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Generar QR
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card
        title="3) QR"
        subtitle={
          selected
            ? `Registro: ${selected.label}`
            : 'Selecciona un registro para previsualizar'
        }
        right={
          selected ? (
            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={() => {
                const canvas = canvasRef.current
                if (canvas) downloadCanvas(canvas, `qr-${selected.id}.png`)
              }}
            >
              Descargar PNG
            </button>
          ) : null
        }
      >
        {!selected ? (
          <div className="text-slate-600">—</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <div className="rounded-2xl border bg-white p-4 grid place-items-center">
              <QRCodeCanvas
                value={qrPayload}
                size={260}
                includeMargin
                ref={canvasRef}
              />
            </div>
            <div className="space-y-2">
              {!selected.archivo_url && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Recomendación: vinculá un archivo antes de imprimir el QR.
                </div>
              )}
              <div className="text-sm font-medium">Payload</div>
              <div className="text-xs text-slate-600 break-all font-mono">
                {qrPayload}
              </div>
              <div className="text-xs text-slate-500">
                Se guarda en la DB en <code>qr_code_url</code> (como string).
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

