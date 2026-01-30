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

function getRowId(tipo, row) {
  return tipo === TIPOS.HORMIGONES ? row.id_hormigon : row.id_caneria
}

function getRowNombre(tipo, row) {
  if (!row) return ''
  if (tipo === TIPOS.CANERIAS) return row.nro_iso || row.nro_linea || 'Cañería'
  return row.titulo || row.nro_interno || 'Hormigón'
}

function downloadCanvas(canvas, filename) {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

function printCanvas(canvas, title) {
  const dataUrl = canvas.toDataURL('image/png')
  const w = window.open('', '_blank', 'noreferrer')
  if (!w) return
  w.document.write(`
    <html>
      <head>
        <title>${String(title ?? 'QR')}</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
          .wrap { display: grid; place-items: center; gap: 16px; }
          img { width: 320px; height: 320px; image-rendering: pixelated; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div style="font-weight:700">${String(title ?? '')}</div>
          <img src="${dataUrl}" />
        </div>
        <script>
          window.onload = () => { window.print(); }
        </script>
      </body>
    </html>
  `)
  w.document.close()
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
          .select('id_caneria,nro_linea,nro_iso,satelite,archivo_url')
          .order('nro_iso', { ascending: true })
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

  const filteredRows = useMemo(() => {
    if (!qrMode) return rows
    if (!selectedRowId) return rows
    return rows.filter((r) => getRowId(tipo, r) === selectedRowId)
  }, [qrMode, rows, selectedRowId, tipo])

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
                  if (canvas && selectedRowId) downloadCanvas(canvas, `qr-${selectedRowId}.png`)
                }}
              >
                Descargar PNG
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                onClick={() => {
                  const canvas = canvasRef.current
                  if (canvas) printCanvas(canvas, `QR - ${selectedNombre}`)
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
              <QRCodeCanvas value={qrPayload} size={260} includeMargin ref={canvasRef} />
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