import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink-900">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
