import type { ReactNode } from 'react'

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
