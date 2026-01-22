import React from 'react'

export function Card({ title, subtitle, children, right }) {
  return (
    <section className="bg-white border rounded-2xl shadow-sm">
      {(title || subtitle || right) && (
        <header className="px-5 py-4 border-b flex items-start gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold leading-tight">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            )}
          </div>
          {right && <div className="ml-auto">{right}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

