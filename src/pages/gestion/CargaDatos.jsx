import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Card } from '../../components/Card.jsx'
import { TIPOS, upsertFromExcel } from '../../services/db/records.js'

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

export function CargaDatosPage() {
  const [tipo, setTipo] = useState(TIPOS.HORMIGONES)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  const expected = useMemo(() => {
    if (tipo === TIPOS.CANERIAS) {
      return ['nro_linea', 'nro_iso', 'satelite']
    }
    return ['titulo', 'nro_interno', 'peso_total_base_kg', 'satelite']
  }, [tipo])

  async function onRead() {
    if (!file) return
    setError('')
    setResult('')
    setLoading(true)
    try {
      const json = await readExcelToJson(file)
      setRows(json)
    } catch (e) {
      setError(e?.message ?? 'No se pudo parsear el Excel')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function onUpload() {
    setError('')
    setResult('')
    setLoading(true)
    try {
      const res = await upsertFromExcel({ tipo, rows })
      setResult(`Listo. Filas procesadas: ${rows.length}. Registros upsert: ${res.inserted}.`)
    } catch (e) {
      setError(e?.message ?? 'No se pudo cargar a Supabase')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Carga de datos (Excel)</h1>
        <p className="text-sm text-slate-600">
          Sube un Excel y lo carga masivamente en Supabase (modo upsert por clave única).
        </p>
      </div>

      <Card
        title="1) Selecciona tipo y archivo"
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
                setRows([])
                setResult('')
                setError('')
              }}
            >
              <option value={TIPOS.HORMIGONES}>Hormigón</option>
              <option value={TIPOS.CANERIAS}>Cañería</option>
            </select>
          </label>

          <label className="text-sm">
            <div className="text-xs font-medium text-slate-600">Excel</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="mt-1 block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="mt-1 text-xs text-slate-500">
              Esperado: <span className="font-mono">{expected.join(', ')}</span>
            </div>
          </label>

          <div className="flex gap-3 flex-wrap">
            <button
              disabled={!file || loading}
              onClick={onRead}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Leyendo…' : 'Leer Excel'}
            </button>
            <button
              disabled={rows.length === 0 || loading}
              onClick={onUpload}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? 'Cargando…' : 'Cargar a Supabase'}
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

      <Card
        title="2) Vista previa"
        subtitle={rows.length ? `Filas detectadas: ${rows.length}` : 'Leé un Excel para ver datos'}
      >
        {rows.length === 0 ? (
          <div className="text-slate-600">Sin datos.</div>
        ) : (
          <pre className="text-xs overflow-auto rounded-xl bg-slate-950 text-slate-100 p-3">
            {JSON.stringify(rows.slice(0, 5), null, 2)}
          </pre>
        )}
      </Card>
    </div>
  )
}

