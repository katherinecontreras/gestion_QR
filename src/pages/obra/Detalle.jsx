import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Card } from '../../components/Card.jsx'
import { useAuth } from '../../services/auth/useAuth.js'
import { canWrite } from '../../services/auth/roles.js'
import { getRecordById, saveArchivoUrl, TIPOS } from '../../services/db/records.js'
import { createSignedUrl, uploadArchivo } from '../../services/storage/files.js'

function asLabelTipo(tipo) {
  return tipo === TIPOS.CANERIAS ? 'Cañería' : 'Hormigón'
}

export function DetallePage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const tipoParam = searchParams.get('t')
  const tipo = tipoParam === TIPOS.CANERIAS ? TIPOS.CANERIAS : tipoParam === TIPOS.HORMIGONES ? TIPOS.HORMIGONES : null

  const { roleId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState(null)
  const [resolvedTipo, setResolvedTipo] = useState(null)
  const [error, setError] = useState('')

  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [archivoLink, setArchivoLink] = useState('')

  const allowWrite = useMemo(() => canWrite(roleId), [roleId])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await getRecordById({ id, tipo })
        if (mounted) {
          setRecord(res?.data ?? null)
          setResolvedTipo(res?.tipo ?? null)
        }
      } catch (e) {
        if (mounted) setError(e?.message ?? 'No se pudo cargar el registro')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [id, tipo])

  useEffect(() => {
    let mounted = true
    async function resolveArchivoUrl() {
      setArchivoLink('')
      if (!record?.archivo_url) return
      // Si es una URL pública, úsala.
      if (String(record.archivo_url).startsWith('http')) {
        setArchivoLink(record.archivo_url)
        return
      }
      // Si guardamos path interno, generar signed URL.
      try {
        const signed = await createSignedUrl({ path: record.archivo_url })
        if (!mounted) return
        if (signed) setArchivoLink(signed)
      } catch {
        // no-op
      }
    }
    resolveArchivoUrl()
    return () => {
      mounted = false
    }
  }, [record?.archivo_url])

  async function onUpload() {
    if (!allowWrite) return
    if (!file) return
    if (!resolvedTipo) return
    setUploading(true)
    setError('')
    try {
      const { publicUrl, path } = await uploadArchivo({ tipo: resolvedTipo, id, file })
      const archivoUrl = publicUrl ?? path
      await saveArchivoUrl({ tipo: resolvedTipo, id, archivoUrl })
      setRecord((r) => (r ? { ...r, archivo_url: archivoUrl } : r))
      setFile(null)
    } catch (e) {
      setError(e?.message ?? 'No se pudo subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Detalle</h1>
        <p className="text-sm text-slate-600">
          ID: <span className="font-mono">{id}</span>
        </p>
      </div>

      <Card title="Ficha" subtitle={resolvedTipo ? asLabelTipo(resolvedTipo) : '—'}>
        {loading ? (
          <div className="text-slate-600">Cargando…</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : !record ? (
          <div className="text-slate-600">No se encontró el registro.</div>
        ) : (
          <div className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              {resolvedTipo === TIPOS.HORMIGONES ? (
                <>
                  <Field label="Título" value={record.titulo} />
                  <Field label="Nro interno" value={record.nro_interno} />
                  <Field label="Satélite" value={record.satelite} />
                  <Field label="Peso base (kg)" value={record.peso_total_base_kg} />
                </>
              ) : (
                <>
                  <Field label="Satélite" value={record.satelite} />
                  <Field label="Nro línea" value={record.nro_linea} />
                  <Field label="Nro ISO" value={record.nro_iso} />
                </>
              )}
            </div>

            <div className="pt-2 border-t">
              <div className="text-sm font-medium">Documentación</div>
              {archivoLink ? (
                <a
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  href={archivoLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar / Ver archivo
                </a>
              ) : (
                <div className="mt-2 text-sm text-slate-600">
                  No hay archivo vinculado.
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {allowWrite && resolvedTipo && (
        <Card
          title="Vincular archivo"
          subtitle="Solo Calidad/Admin. Sube un PDF/imagen y queda asociado al registro."
        >
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <label className="block flex-1">
              <div className="text-sm font-medium text-slate-700">Archivo</div>
              <input
                type="file"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="mt-1 text-xs text-slate-500">
                Sube a Storage y guarda la URL/path en <code>archivo_url</code>.
              </div>
            </label>
            <button
              disabled={!file || uploading}
              onClick={onUpload}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {uploading ? 'Subiendo…' : 'Subir y vincular'}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900 break-words">
        {value ?? '—'}
      </div>
    </div>
  )
}

