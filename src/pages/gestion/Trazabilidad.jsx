import React, { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card.jsx'
import { supabase } from '../../services/supabaseClient.js'
import { TIPOS, saveArchivoUrl } from '../../services/db/records.js'
import { createSignedUrl, uploadArchivo } from '../../services/storage/files.js'
import { useAuth } from '../../services/auth/useAuth.js'
import { canWrite } from '../../services/auth/roles.js'

export function TrazabilidadPage() {
  const { roleId } = useAuth()
  const allowWrite = useMemo(() => canWrite(roleId), [roleId])

  const [tipo, setTipo] = useState(TIPOS.HORMIGONES)
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingTable, setLoadingTable] = useState(true)
  const [stats, setStats] = useState({ hormigones: 0, canerias: 0 })
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [uploadingId, setUploadingId] = useState(null)

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
        if (mounted) setError(e?.message ?? 'No se pudo cargar la pagina de trazabilidad')
      } finally {
        if (mounted) setLoadingStats(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadTable() {
      setLoadingTable(true)
      setError('')
      try {
        if (tipo === TIPOS.HORMIGONES) {
          const { data, error: e } = await supabase
            .from('hormigones')
            .select('id_hormigon,titulo,nro_interno,peso_total_base_kg,satelite,archivo_url')
            .order('titulo', { ascending: true })
            .limit(200)
          if (e) throw e
          if (mounted) setRows(data ?? [])
        } else {
          const { data, error: e } = await supabase
            .from('canerias')
            .select('id_caneria,nro_linea,nro_iso,satelite,archivo_url')
            .order('nro_iso', { ascending: true })
            .limit(200)
          if (e) throw e
          if (mounted) setRows(data ?? [])
        }
      } catch (e) {
        if (mounted) setError(e?.message ?? 'No se pudo cargar la tabla')
      } finally {
        if (mounted) setLoadingTable(false)
      }
    }
    loadTable()
    return () => {
      mounted = false
    }
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

  return (
    <div className="space-y-4">
      <div className="w-full flex justify-between align-center border-b pb-4">
        <div className="flex w-1/2 flex-col gap-2">
          <h1 className="text-xl font-semibold">Trazabilidad</h1>
          <p className="text-sm text-slate-600 ">Resumen rápido de trazabilidad.</p>
        </div>
        <div className="grid w-1/2 sm:grid-cols-2 gap-3">
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
        title={tipo === TIPOS.HORMIGONES ? 'Hormigones' : 'Cañerías'}
        subtitle={
          tipo === TIPOS.HORMIGONES
            ? 'Mostrando columnas: título, nro interno, peso base, satélite, archivo.'
            : 'Mostrando columnas: nro línea, nro ISO, satélite, archivo.'
        }
        right={
          <div className="text-xs text-slate-500">
            {loadingTable ? 'Cargando…' : `Filas: ${rows.length}`}
          </div>
        }
      >
        {loadingTable ? (
          <div className="text-slate-600">Cargando tabla…</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr className="border-b">
                  {tipo === TIPOS.HORMIGONES ? (
                    <>
                      <Th>Título</Th>
                      <Th>Nro interno</Th>
                      <Th>Peso base (kg)</Th>
                      <Th>Satélite</Th>
                      <Th>Archivo</Th>
                    </>
                  ) : (
                    <>
                      <Th>Nro línea</Th>
                      <Th>Nro ISO</Th>
                      <Th>Satélite</Th>
                      <Th>Archivo</Th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const rowId =
                    tipo === TIPOS.HORMIGONES ? r.id_hormigon : r.id_caneria
                  const hasFile = Boolean(r.archivo_url)
                  return (
                    <tr key={rowId} className="align-top">
                      {tipo === TIPOS.HORMIGONES ? (
                        <>
                          <Td className="font-medium">{r.titulo}</Td>
                          <Td className="font-mono">{r.nro_interno}</Td>
                          <Td>{r.peso_total_base_kg ?? '—'}</Td>
                          <Td>{r.satelite ?? '—'}</Td>
                          <Td>
                            <ArchivoCell
                              allowWrite={allowWrite}
                              hasFile={hasFile}
                              archivoUrl={r.archivo_url}
                              uploading={uploadingId === rowId}
                              onOpen={() => onOpenArchivo(r.archivo_url)}
                              onUpload={(file) => onUpload({ rowId, file })}
                            />
                          </Td>
                        </>
                      ) : (
                        <>
                          <Td className="font-mono">{r.nro_linea}</Td>
                          <Td className="font-mono">{r.nro_iso}</Td>
                          <Td>{r.satelite ?? '—'}</Td>
                          <Td>
                            <ArchivoCell
                              allowWrite={allowWrite}
                              hasFile={hasFile}
                              archivoUrl={r.archivo_url}
                              uploading={uploadingId === rowId}
                              onOpen={() => onOpenArchivo(r.archivo_url)}
                              onUpload={(file) => onUpload({ rowId, file })}
                            />
                          </Td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatButton({ label, value, active, loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-4 text-left transition',
        active
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-slate-200 bg-slate-50 hover:bg-white',
      ].join(' ')}
    >
      <div className={['text-xs font-medium', active ? 'text-emerald-700' : 'text-slate-600'].join(' ')}>
        {label}
      </div>
      <div className={['mt-1 text-2xl font-semibold', active ? 'text-emerald-700' : 'text-slate-900'].join(' ')}>
        {loading ? '—' : value}
      </div>
    </button>
  )
}

function Th({ children }) {
  return <th className="py-2 pr-4 font-semibold">{children}</th>
}

function Td({ children, className = '' }) {
  return <td className={['py-3 pr-4', className].join(' ')}>{children}</td>
}

function ArchivoCell({ allowWrite, hasFile, archivoUrl, uploading, onOpen, onUpload }) {
  if (hasFile) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
          onClick={onOpen}
        >
          Ver/Descargar
        </button>
        <span className="text-xs text-emerald-700 font-medium">OK</span>
        <span className="text-xs text-slate-400 font-mono truncate max-w-[220px]">
          {String(archivoUrl)}
        </span>
      </div>
    )
  }

  if (!allowWrite) {
    return <span className="text-xs text-slate-500">Sin archivo</span>
  }

  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ''
          if (f) onUpload(f)
        }}
      />
      <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer select-none">
        {uploading ? 'Subiendo…' : 'Subir archivo'}
      </span>
      <span className="text-xs text-amber-700 font-medium">Falta</span>
    </label>
  )
}

