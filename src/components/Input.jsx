import React from 'react'

export function Input({ label, hint, error, ...props }) {
  return (
    <label className="block">
      {label && <div className="text-sm font-medium text-slate-700">{label}</div>}
      <input
        {...props}
        className={[
          'mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none',
          error ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-slate-200 focus:ring-2 focus:ring-slate-200',
          props.className ?? '',
        ].join(' ')}
      />
      {hint && !error && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      {error && <div className="mt-1 text-xs text-rose-600">{error}</div>}
    </label>
  )
}

