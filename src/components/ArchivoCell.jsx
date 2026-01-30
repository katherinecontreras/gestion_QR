import React from 'react'

export default function ArchivoCell({ allowWrite, hasFile, archivoUrl, uploading, onOpen, onUpload }) {
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
