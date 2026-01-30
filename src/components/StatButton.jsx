import React from 'react'

export default function StatButton({ label, value, active, loading, onClick }) {
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
