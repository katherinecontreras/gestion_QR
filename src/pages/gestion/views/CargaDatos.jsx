import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Card } from '../../../components/Card.jsx'
import { TIPOS, upsertFromExcel } from '../../../services/db/records.js'

function readExcelToJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result)
        const wb = XLSX.read(data, { type: 'array' })
        const sheetName = wb.SheetNames?.[0]
        if (!sheetName) return resolve([])
        const ws = wb.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(ws, { defval: null })
        resolve(json)
      } catch (e) {
        reject(e)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

function readHormigonesFixed(file) {
  // Formato fijo:
  // - desde fila 3 (1-indexed)
  // - satelite: columna A
  // - titulo: columna C
  // - nro_interno: columna E (clave única)
  // - peso_total_base_kg: columna I
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result)
        const wb = XLSX.read(data, { type: 'array' })
        const sheetName = wb.SheetNames?.[0]
        if (!sheetName) return resolve([])
        const ws = wb.Sheets[sheetName]
        const ref = ws['!ref']
        if (!ref) return resolve([])
        const range = XLSX.utils.decode_range(ref)

        function cellValue(r0, c0) {
          const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
          const v = ws[addr]?.v ?? null
          if (v == null) return null
          if (typeof v === 'string') return v.trim()
          return v
        }

        const out = []
        const startRow0 = 2 // fila 3 (1-indexed) => r=2 (0-indexed)
        for (let r = startRow0; r <= range.e.r; r++) {
          const satelite = cellValue(r, 0) // A
          const titulo = cellValue(r, 2) // C
          const nro_interno = cellValue(r, 4) // E
          const peso_total_base_kg = cellValue(r, 8) // I

          const nro = String(nro_interno ?? '').trim()
          if (!nro) continue

          out.push({
            satelite: satelite == null || satelite === '' ? null : String(satelite).trim(),
            titulo: titulo == null || titulo === '' ? null : String(titulo).trim(),
            nro_interno: nro,
            peso_total_base_kg: peso_total_base_kg == null || peso_total_base_kg === '' ? null : peso_total_base_kg,
          })
        }
        resolve(out)
      } catch (e) {
        reject(e)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

function isExcelFile(file) {
  if (!file) return false
  const name = String(file.name ?? '').toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}

export function CargaDatosModal({ open, onClose, initialTipo = TIPOS.HORMIGONES, onUploaded }) {
  const [tipo, setTipo] = useState(TIPOS.HORMIGONES)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [dragging, setDragging] = useState(false)

  const expected = useMemo(() => {
    if (tipo === TIPOS.CANERIAS) {
      return ['nro_linea', 'nro_iso', 'satelite']
    }
    return [
      'Desde fila 3',
      'A = satelite',
      'C = titulo',
      'E = nro_interno (clave única)',
      'I = peso_total_base_kg',
    ]
  }, [tipo])

  React.useEffect(() => {
    if (!open) return
    setTipo(initialTipo)
    setFile(null)
    setLoading(false)
    setError('')
    setResult('')
    setDragging(false)
  }, [open, initialTipo])

  async function parseSelectedFile() {
    if (!file) return []
    return tipo === TIPOS.HORMIGONES ? await readHormigonesFixed(file) : await readExcelToJson(file)
  }

  async function onCargarDatos() {
    if (!file) return
    setError('')
    setResult('')
    setLoading(true)
    try {
      const json = await parseSelectedFile()
      if (!json.length) {
        setError('No se detectaron filas para cargar (revisá formato/hoja).')
        return
      }
      const res = await upsertFromExcel({ tipo, rows: json })
      const inserted = res.inserted ?? 0
      const updated = res.updated ?? 0
      const total = res.total ?? json.length
      setResult(
        `¡Listo! Se insertaron correctamente ${inserted} registros nuevos y se actualizaron ${updated} registros existentes. (Total procesado: ${total})`,
      )
      onUploaded?.({ tipo, rowsCount: total, inserted, updated })
    } catch (e) {
      setError(e?.message ?? 'No se pudo cargar a Supabase')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="absolute inset-0 bg-slate-950/40" />
      <div className="absolute inset-0 overflow-auto">
        <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-lg">
            <div className="px-5 py-4 border-b flex items-start gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold leading-tight">
                  Carga de datos (Excel)
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Arrastrá un Excel o seleccioná uno. Luego podés previsualizarlo y cargarlo (upsert) a Supabase.
                </div>
              </div>
              <div className="ml-auto">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  onClick={() => onClose?.()}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <Card
                title="Selecciona tipo y archivo"
                subtitle="Se lee la primera hoja del Excel. Las columnas deben coincidir (o muy parecido)."
              >
                <div className="grid gap-3">
                  <label className="text-sm">
                    <div className="text-xs font-medium text-slate-600">Tipo de dato</div>
                    <select
                      className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={tipo}
                      onChange={(e) => {
                        setTipo(e.target.value)
                        setResult('')
                        setError('')
                      }}
                    >
                      <option value={TIPOS.HORMIGONES}>Hormigón</option>
                      <option value={TIPOS.CANERIAS}>Cañería</option>
                    </select>
                  </label>

                  <div
                    className={[
                      'rounded-2xl border-2 border-dashed p-4 transition',
                      dragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50',
                    ].join(' ')}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragging(true)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragging(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragging(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragging(false)
                      const f = e.dataTransfer?.files?.[0] ?? null
                      if (!f) return
                      if (!isExcelFile(f)) {
                        setError('El archivo debe ser .xlsx o .xls')
                        return
                      }
                      setFile(f)
                      setResult('')
                      setError('')
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Excel</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {file ? (
                            <span className="font-mono break-all">{file.name}</span>
                          ) : (
                            'Arrastrá y soltá aquí tu Excel, o elegilo con el botón.'
                          )}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Esperado: <span className="font-mono">{expected.join(', ')}</span>
                        </div>
                      </div>
                      <div className="ml-auto shrink-0">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null
                              e.target.value = ''
                              if (!f) return
                              if (!isExcelFile(f)) {
                                setError('El archivo debe ser .xlsx o .xls')
                                return
                              }
                              setFile(f)
                              setResult('')
                              setError('')
                            }}
                          />
                          <span className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer select-none">
                            Seleccionar Excel
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <button
                      disabled={!file || loading}
                      onClick={onCargarDatos}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {loading ? 'Cargando…' : 'Cargar datos'}
                    </button>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {error}
                    </div>
                  )}
                  {result && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {result}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compat: si alguna ruta vieja la usa todavía.
export function CargaDatosPage() {
  const [open, setOpen] = useState(true)
  return <CargaDatosModal open={open} onClose={() => setOpen(false)} />
}

