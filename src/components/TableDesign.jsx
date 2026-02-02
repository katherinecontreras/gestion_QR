import React from 'react'
import { TIPOS } from '../services/db/records.js'
import ArchivoCell from './ArchivoCell.jsx'

function Th({ children }) {
  return <th className="py-2 pr-4 font-semibold">{children}</th>
}

function Td({ children, className = '' }) {
  return <td className={['py-3 pr-4', className].join(' ')}>{children}</td>
}

export default function TableDesign({
  tipo,
  rows,
  allowWrite,
  uploadingId,
  onOpenArchivo,
  onUpload,
  selectMode = false,
  selectedRowId = null,
  onSelectRow,
}) {
  return (
    <table className="min-w-[900px] w-full text-sm">
      <thead className="text-left text-slate-600">
        <tr className="border-b">
          {selectMode && <Th>Seleccionar</Th>}
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
              <Th>Cantidad</Th>
              <Th>Satélite</Th>
              <Th>Archivo</Th>
            </>
          )}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r, idx) => {
          const rowId =
            tipo === TIPOS.HORMIGONES ? r.id_hormigon : r.id_caneria
          const hasFile = Boolean(r.archivo_url)
          const isSelected = selectedRowId != null && selectedRowId === rowId
          const key =
            rowId ??
            `${tipo}-${String(r.nro_iso ?? '')}-${String(r.nro_linea ?? '')}-${String(r.satelite ?? '')}-${idx}`
          return (
            <tr key={key} className="align-top">
              {selectMode && (
                <Td className="w-12">
                  <input
                    type="radio"
                    name="table-select"
                    checked={isSelected}
                    onChange={() => onSelectRow?.({ rowId, row: r })}
                  />
                </Td>
              )}
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
                  <Td className="font-mono">{r.cantidad ?? 1}</Td>
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
  )
}