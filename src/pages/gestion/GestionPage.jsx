import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import StatButton from '../../components/StatButton.jsx'
import { Card } from '../../components/Card.jsx'
import TableDesign from '../../components/TableDesign.jsx'
import { supabase } from '../../services/supabaseClient.js'
import { TIPOS, buildQrPayload, saveQrPayload, saveArchivoUrl } from '../../services/db/records.js'
import { createSignedUrl, uploadArchivo } from '../../services/storage/files.js'
import { useAuth } from '../../services/auth/useAuth.js'
import { canWrite } from '../../services/auth/roles.js'
import { CargaDatosModal } from './views/CargaDatos.jsx'
import { QRCodeCanvas } from 'qrcode.react'

function normStr(v) {
  return String(v ?? '').trim()
}

function includesCI(haystack, needle) {
  const h = normStr(haystack).toLowerCase()
  const n = normStr(needle).toLowerCase()
  if (!n) return true
  return h.includes(n)
}

function uniqNonEmpty(values) {
  const out = []
  const seen = new Set()
  for (const v of values) {
    const s = normStr(v)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function applyGestionFilters({ tipo, rows, qA, qB, satFilter }) {
  let out = rows

  if (tipo === TIPOS.HORMIGONES) {
    if (normStr(qA)) out = out.filter((r) => includesCI(r.titulo, qA))
    if (normStr(qB)) out = out.filter((r) => includesCI(r.nro_interno, qB))
    if (normStr(satFilter)) out = out.filter((r) => normStr(r.satelite) === normStr(satFilter))
    return out
  }

  if (normStr(qA)) out = out.filter((r) => includesCI(r.nro_linea, qA))
  if (normStr(qB)) out = out.filter((r) => includesCI(r.nro_iso, qB))
  if (normStr(satFilter)) out = out.filter((r) => normStr(r.satelite) === normStr(satFilter))
  return out
}

function AutocompleteInput({
  label,
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  disabled,
}) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const shown = useMemo(() => suggestions.slice(0, 5), [suggestions])

  return (
    <label className="text-sm relative">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
        onChange={(e) => {
          onChange(e.target.value)
          setActiveIdx(0)
          setOpen(true)
        }}
        onFocus={() => {
          setActiveIdx(0)
          setOpen(true)
        }}
        onBlur={() => {
          // dejamos que el click en una opción se procese con onMouseDown
          setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIdx((i) => Math.min(i + 1, Math.max(0, shown.length - 1)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            const pick = shown[Math.min(activeIdx, Math.max(0, shown.length - 1))]
            if (pick) {
              e.preventDefault()
              onSelect(pick)
              setOpen(false)
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && !disabled && shown.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
          {shown.map((s, idx) => (
            <div
              key={`${s}-${idx}`}
              className={[
                'px-3 py-2 text-sm cursor-pointer',
                idx === activeIdx ? 'bg-slate-100' : 'hover:bg-slate-50',
              ].join(' ')}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(s)
                setOpen(false)
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </label>
  )
}

function getRowId(tipo, row) {
  return tipo === TIPOS.HORMIGONES ? row.id_hormigon : row.id_caneria
}

function getRowNombre(tipo, row) {
  if (!row) return ''
  if (tipo === TIPOS.CANERIAS) return row.nro_iso || row.nro_linea || 'Cañería'
  return row.titulo || row.nro_interno || 'Hormigón'
}

function toQrEtiquetaDataUrl(canvas, text) {
  const t = normStr(text)
  if (!canvas || !t) return canvas?.toDataURL?.('image/png') ?? ''

  const w = canvas.width
  const h = canvas.height
  if (!w || !h) return canvas.toDataURL('image/png')

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')

  // dibuja el QR original
  ctx.drawImage(canvas, 0, 0)

  // etiqueta al centro (poco invasiva) + level="H" en el QR
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let fontSize = Math.max(12, Math.round(w * 0.085))
  const fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

  const maxTextWidth = w * 0.72
  while (fontSize > 10) {
    ctx.font = `800 ${fontSize}px ${fontFamily}`
    if (ctx.measureText(t).width <= maxTextWidth) break
    fontSize -= 1
  }

  const textWidth = ctx.measureText(t).width
  const padX = Math.round(fontSize * 0.8)
  const padY = Math.round(fontSize * 0.55)
  const boxW = Math.min(w * 0.78, textWidth + padX * 2)
  const boxH = Math.min(h * 0.22, fontSize + padY * 2)

  const cx = w / 2
  const cy = h / 2
  const x = cx - boxW / 2
  const y = cy - boxH / 2

  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.beginPath()
  ctx.roundRect(x, y, boxW, boxH, Math.round(boxH / 2))
  ctx.fill()

  ctx.fillStyle = '#1f2937'
  ctx.font = `800 ${fontSize}px ${fontFamily}`
  ctx.fillText(t, cx, cy)

  ctx.restore()
  return out.toDataURL('image/png')
}

function QrConEtiqueta({ value, label, canvasRef, size = 260 }) {
  return (
    <div className="relative inline-block">
      <QRCodeCanvas
        key={value}
        value={value}
        size={size}
        includeMargin
        level="H"
        ref={canvasRef}
      />
      <div
        className={[
          'pointer-events-none',
          'absolute inset-0 grid place-items-center',
        ].join(' ')}
      >
        <div className="bg-white/95 px-3 py-1 rounded-full shadow text-xs font-semibold text-slate-800 max-w-[75%] truncate">
          {label}
        </div>
      </div>
    </div>
  )
}

export default function GestionPage() {
  const location = useLocation()
  const { roleId } = useAuth()
  const allowWrite = useMemo(() => canWrite(roleId), [roleId])

  const [tipo, setTipo] = useState(TIPOS.HORMIGONES)
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingTable, setLoadingTable] = useState(true)
  const [stats, setStats] = useState({ hormigones: 0, canerias: 0 })
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [uploadingId, setUploadingId] = useState(null)

  const [openCargaModal, setOpenCargaModal] = useState(false)

  // Filtros
  const [qA, setQA] = useState('') // hormigon: titulo | caneria: nro_linea
  const [qB, setQB] = useState('') // hormigon: nro_interno | caneria: nro_iso
  const [satFilter, setSatFilter] = useState('') // '' = todos
  const [sortMode, setSortMode] = useState('') // '' | asc | desc (según tipo)

  // Flujo QR embebido
  const [qrMode, setQrMode] = useState(false) // agrega columna seleccionar
  const [selectedRowId, setSelectedRowId] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [qrGenerated, setQrGenerated] = useState(false)
  const canvasRef = useRef(null)

  const selectedNombre = useMemo(() => getRowNombre(tipo, selectedRow), [tipo, selectedRow])
  const qrPayload = useMemo(() => {
    if (!selectedRowId) return ''
    return buildQrPayload({ id: selectedRowId, tipo })
  }, [selectedRowId, tipo])

  const qrCenterLabel = useMemo(() => {
    if (!selectedRow) return ''
    if (tipo === TIPOS.HORMIGONES) return selectedRow.nro_interno ?? ''
    // Para cañerías (soldadura), mostramos nro_linea
    return selectedRow.nro_linea ?? ''
  }, [selectedRow, tipo])

  useEffect(() => {
    // Compat con rutas viejas: /carga-datos y /generar-qr
    if (location.pathname.endsWith('/carga-datos')) {
      setOpenCargaModal(true)
    }
    if (location.pathname.endsWith('/generar-qr')) {
      setQrMode(true)
    }
  }, [location.pathname])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoadingStats(true)
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
        if (mounted) setError(e?.message ?? 'No se pudo cargar la página de gestión')
      } finally {
        if (mounted) setLoadingStats(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  async function loadTable(currentTipo) {
    setLoadingTable(true)
    setError('')
    try {
      if (currentTipo === TIPOS.HORMIGONES) {
        const { data, error: e } = await supabase
          .from('hormigones')
          .select('id_hormigon,titulo,nro_interno,peso_total_base_kg,satelite,archivo_url')
          .order('titulo', { ascending: true })
          .limit(200)
        if (e) throw e
        setRows(data ?? [])
      } else {
        const { data, error: e } = await supabase
          .from('canerias')
          .select('id_caneria,nro_linea,nro_iso,cantidad,satelite,archivo_url')
          .order('nro_iso', { ascending: true })
          .order('satelite', { ascending: true })
          .order('nro_linea', { ascending: true })
          .limit(200)
        if (e) throw e
        setRows(data ?? [])
      }
    } catch (e) {
      setError(e?.message ?? 'No se pudo cargar la tabla')
      setRows([])
    } finally {
      setLoadingTable(false)
    }
  }

  useEffect(() => {
    loadTable(tipo)
    // si cambia el tipo, reseteamos selección QR para evitar inconsistencias
    setSelectedRowId(null)
    setSelectedRow(null)
    setQrGenerated(false)
    // reseteamos filtros al cambiar tipo
    setQA('')
    setQB('')
    setSatFilter('')
    setSortMode('')
  }, [tipo])

  async function onOpenArchivo(archivoUrl) {
    if (!archivoUrl) return
    if (String(archivoUrl).startsWith('http')) {
      window.open(archivoUrl, '_blank', 'noreferrer')
      return
    }
    const signed = await createSignedUrl({ path: archivoUrl })
    if (signed) window.open(signed, '_blank', 'noreferrer')
  }

  async function onUpload({ rowId, file }) {
    if (!allowWrite) return
    if (!file) return
    setUploadingId(rowId)
    setError('')
    try {
      const { publicUrl, path } = await uploadArchivo({ tipo, id: rowId, file })
      const archivoUrl = publicUrl ?? path
      await saveArchivoUrl({ tipo, id: rowId, archivoUrl })
      setRows((prev) =>
        prev.map((r) => {
          const idKey = tipo === TIPOS.HORMIGONES ? 'id_hormigon' : 'id_caneria'
          return r[idKey] === rowId ? { ...r, archivo_url: archivoUrl } : r
        }),
      )
    } catch (e) {
      setError(e?.message ?? 'No se pudo subir el archivo')
    } finally {
      setUploadingId(null)
    }
  }

  async function onGenerateQr() {
    if (!selectedRowId) return
    setError('')
    setQrGenerated(true)
    try {
      await saveQrPayload({ tipo, id: selectedRowId, qrPayload })
    } catch (e) {
      setError(
        e?.message ??
          'Se generó el QR pero no se pudo guardar en la DB (revisar permisos/RLS).',
      )
    }
  }

  // Base: en modo QR y seleccionado, se muestra solo el seleccionado.
  const baseRowsForFilters = useMemo(() => {
    if (qrMode && selectedRowId) {
      return rows.filter((r) => getRowId(tipo, r) === selectedRowId)
    }
    return rows
  }, [qrMode, selectedRowId, rows, tipo])

  // Cascada: cada filtro opera sobre el resultado de los otros filtros.
  // Para autocompletado calculamos el “scope” filtrado por los demás (excluyendo ese input).
  const scopeForA = useMemo(() => {
    return applyGestionFilters({ tipo, rows: baseRowsForFilters, qA: '', qB, satFilter })
  }, [tipo, baseRowsForFilters, qB, satFilter])

  const scopeForB = useMemo(() => {
    return applyGestionFilters({ tipo, rows: baseRowsForFilters, qA, qB: '', satFilter })
  }, [tipo, baseRowsForFilters, qA, satFilter])

  const scopeForSat = useMemo(() => {
    return applyGestionFilters({ tipo, rows: baseRowsForFilters, qA, qB, satFilter: '' })
  }, [tipo, baseRowsForFilters, qA, qB])

  const satOptions = useMemo(() => {
    return uniqNonEmpty(scopeForSat.map((r) => r.satelite)).sort((a, b) => a.localeCompare(b))
  }, [scopeForSat])

  const suggestionsA = useMemo(() => {
    if (!normStr(qA)) return []
    if (tipo === TIPOS.HORMIGONES) {
      return uniqNonEmpty(scopeForA.map((r) => r.titulo).filter((v) => includesCI(v, qA))).slice(0, 5)
    }
    return uniqNonEmpty(scopeForA.map((r) => r.nro_linea).filter((v) => includesCI(v, qA))).slice(0, 5)
  }, [scopeForA, qA, tipo])

  const suggestionsB = useMemo(() => {
    if (!normStr(qB)) return []
    if (tipo === TIPOS.HORMIGONES) {
      return uniqNonEmpty(scopeForB.map((r) => r.nro_interno).filter((v) => includesCI(v, qB))).slice(0, 5)
    }
    return uniqNonEmpty(scopeForB.map((r) => r.nro_iso).filter((v) => includesCI(v, qB))).slice(0, 5)
  }, [scopeForB, qB, tipo])

  const filteredRows = useMemo(() => {
    let out = applyGestionFilters({ tipo, rows: baseRowsForFilters, qA, qB, satFilter })

    if (tipo === TIPOS.HORMIGONES) {
      if (sortMode === 'asc' || sortMode === 'desc') {
        const dir = sortMode === 'asc' ? 1 : -1
        out = [...out].sort((a, b) => {
          const av = typeof a.peso_total_base_kg === 'number' ? a.peso_total_base_kg : Number(a.peso_total_base_kg)
          const bv = typeof b.peso_total_base_kg === 'number' ? b.peso_total_base_kg : Number(b.peso_total_base_kg)
          const aOk = Number.isFinite(av)
          const bOk = Number.isFinite(bv)
          if (!aOk && !bOk) return 0
          if (!aOk) return 1
          if (!bOk) return -1
          return (av - bv) * dir
        })
      }
      return out
    }

    if (sortMode === 'asc' || sortMode === 'desc') {
      const dir = sortMode === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => {
        const av = Number(a.cantidad ?? 1)
        const bv = Number(b.cantidad ?? 1)
        return (av - bv) * dir
      })
    }
    return out
  }, [tipo, baseRowsForFilters, qA, qB, satFilter, sortMode])

  return (
    <div className="space-y-4">
      <div className="w-full flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Gestión</h1>
          <p className="text-sm text-slate-600">
            Mantén el header fijo y cambiá la vista con los botones.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
              onClick={() => setOpenCargaModal(true)}
            >
              Cargar datos
            </button>
            <button
              type="button"
              className={[
                'rounded-xl border px-3 py-1.5 text-sm font-semibold',
                qrMode ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white hover:bg-slate-50',
              ].join(' ')}
              onClick={() => {
                setQrMode(true)
                setQrGenerated(false)
                setSelectedRowId(null)
                setSelectedRow(null)
              }}
            >
              Generar QR
            </button>
            {qrMode && (
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                onClick={() => {
                  setQrMode(false)
                  setQrGenerated(false)
                  setSelectedRowId(null)
                  setSelectedRow(null)
                }}
              >
                Volver a tabla
              </button>
            )}
          </div>
        </div>

        <div className="grid w-full sm:w-auto sm:min-w-[360px] sm:grid-cols-2 gap-3">
          <StatButton
            active={tipo === TIPOS.HORMIGONES}
            label="Hormigones"
            value={stats.hormigones}
            loading={loadingStats}
            onClick={() => setTipo(TIPOS.HORMIGONES)}
          />
          <StatButton
            active={tipo === TIPOS.CANERIAS}
            label="Cañerías"
            value={stats.canerias}
            loading={loadingStats}
            onClick={() => setTipo(TIPOS.CANERIAS)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card
        title={
          qrGenerated
            ? `QR de ${selectedNombre || 'registro'}`
            : tipo === TIPOS.HORMIGONES
              ? 'Hormigones'
              : 'Cañerías'
        }
        subtitle={
          qrGenerated
            ? 'Descargá o imprimí el QR. Luego podés volver a la tabla.'
            : tipo === TIPOS.HORMIGONES
              ? 'Mostrando columnas: título, nro interno, peso base, satélite, archivo.'
              : 'Mostrando columnas: nro línea, nro ISO, satélite, archivo.'
        }
        right={
          qrGenerated ? (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={() => {
                  const canvas = canvasRef.current
                  if (!canvas || !selectedRowId) return
                  const dataUrl = toQrEtiquetaDataUrl(canvas, qrCenterLabel)
                  const a = document.createElement('a')
                  a.href = dataUrl
                  a.download = `qr-${selectedRowId}.png`
                  a.click()
                }}
              >
                Descargar PNG
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                onClick={() => {
                  const canvas = canvasRef.current
                  if (!canvas) return
                  const dataUrl = toQrEtiquetaDataUrl(canvas, qrCenterLabel)
                  const w = window.open('', '_blank', 'noreferrer')
                  if (!w) return
                  w.document.write(`
                    <html>
                      <head>
                        <title>${String(`QR - ${selectedNombre}`)}</title>
                        <style>
                          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
                          .wrap { display: grid; place-items: center; gap: 16px; }
                          img { width: 320px; height: 320px; image-rendering: pixelated; }
                        </style>
                      </head>
                      <body>
                        <div class="wrap">
                          <div style="font-weight:700">${String(`QR - ${selectedNombre}`)}</div>
                          <img src="${dataUrl}" />
                        </div>
                        <script>
                          window.onload = () => { window.print(); }
                        </script>
                      </body>
                    </html>
                  `)
                  w.document.close()
                }}
              >
                Imprimir
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                onClick={() => {
                  setQrGenerated(false)
                  setQrMode(false)
                  setSelectedRowId(null)
                  setSelectedRow(null)
                }}
              >
                Volver
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              {loadingTable ? 'Cargando…' : `Filas: ${filteredRows.length}`}
            </div>
          )
        }
      >
        {loadingTable ? (
          <div className="text-slate-600">Cargando…</div>
        ) : qrGenerated ? (
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <div className="rounded-2xl border bg-white p-4 grid place-items-center">
              <QrConEtiqueta value={qrPayload} label={qrCenterLabel} canvasRef={canvasRef} size={260} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Nombre</div>
              <div className="text-sm text-slate-800">{selectedNombre}</div>
              <div className="text-sm font-medium">Payload</div>
              <div className="text-xs text-slate-600 break-all font-mono">{qrPayload}</div>
              <div className="text-xs text-slate-500">
                Se guarda en la DB en <code>qr_code_url</code>.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!qrMode || !selectedRowId ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tipo === TIPOS.HORMIGONES ? (
                  <>
                    <AutocompleteInput
                      disabled={loadingTable}
                      label="Buscar por título"
                      value={qA}
                      onChange={setQA}
                      onSelect={(v) => setQA(v)}
                      suggestions={suggestionsA}
                      placeholder="Escribe para buscar…"
                    />
                    <AutocompleteInput
                      disabled={loadingTable}
                      label="Buscar por nro interno"
                      value={qB}
                      onChange={setQB}
                      onSelect={(v) => setQB(v)}
                      suggestions={suggestionsB}
                      placeholder="Escribe para buscar…"
                    />
                  </>
                ) : (
                  <>
                    <AutocompleteInput
                      disabled={loadingTable}
                      label="Buscar por nro ISO"
                      value={qB}
                      onChange={setQB}
                      onSelect={(v) => setQB(v)}
                      suggestions={suggestionsB}
                      placeholder="Escribe para buscar…"
                    />
                    <AutocompleteInput
                      disabled={loadingTable}
                      label="Buscar por nro línea"
                      value={qA}
                      onChange={setQA}
                      onSelect={(v) => setQA(v)}
                      suggestions={suggestionsA}
                      placeholder="Escribe para buscar…"
                    />
                  </>
                )}

                <label className="text-sm">
                  <div className="text-xs font-medium text-slate-600">Filtrar por satélite</div>
                  <select
                    disabled={loadingTable}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                    value={satFilter}
                    onChange={(e) => setSatFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {satOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs font-medium text-slate-600">
                    {tipo === TIPOS.HORMIGONES ? 'Ordenar por peso' : 'Ordenar por cantidad'}
                  </div>
                  <select
                    disabled={loadingTable}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value)}
                  >
                    <option value="">Sin ordenar</option>
                    <option value="desc">Mayor a menor</option>
                    <option value="asc">Menor a mayor</option>
                  </select>
                </label>

                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    onClick={() => {
                      setQA('')
                      setQB('')
                      setSatFilter('')
                      setSortMode('')
                    }}
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>
            ) : null}

            {qrMode && selectedRowId && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm text-slate-700">
                  Seleccionado: <span className="font-semibold">{selectedNombre}</span>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                  onClick={() => {
                    setSelectedRowId(null)
                    setSelectedRow(null)
                  }}
                >
                  Cambiar selección
                </button>
              </div>
            )}

            <div className="overflow-auto">
              <TableDesign
                tipo={tipo}
                rows={filteredRows}
                allowWrite={allowWrite}
                uploadingId={uploadingId}
                onOpenArchivo={onOpenArchivo}
                onUpload={onUpload}
                selectMode={qrMode}
                selectedRowId={selectedRowId}
                onSelectRow={({ rowId, row }) => {
                  setSelectedRowId(rowId)
                  setSelectedRow(row)
                }}
              />
            </div>

            {qrMode && selectedRowId && (
              <div className="pt-2">
                <button
                  type="button"
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={onGenerateQr}
                >
                  Generar QR de {selectedNombre}
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <CargaDatosModal
        open={openCargaModal}
        onClose={() => setOpenCargaModal(false)}
        initialTipo={tipo}
        onUploaded={() => {
          // refrescamos stats y tabla sin depender del modal
          ;(async () => {
            try {
              const [{ count: hCount }, { count: cCount }] = await Promise.all([
                supabase.from('hormigones').select('*', { count: 'exact', head: true }),
                supabase.from('canerias').select('*', { count: 'exact', head: true }),
              ])
              setStats({ hormigones: hCount ?? 0, canerias: cCount ?? 0 })
            } catch {
              // si falla, no bloqueamos UX
            }
            await loadTable(tipo)
          })()
        }}
      />
    </div>
  )
}