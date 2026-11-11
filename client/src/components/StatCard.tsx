import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const tones: Record<string, { bg: string; text: string }> = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-600' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
}

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: keyof typeof tones
}

export default function StatCard({ label, value, hint, icon: Icon, tone = 'brand' }: StatCardProps) {
  const palette = tones[tone] ?? tones.brand
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 font-display text-3xl leading-none text-ink-900">{value}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${palette.bg} ${palette.text}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {hint ? <p className="mt-3 text-xs font-medium text-slate-500">{hint}</p> : null}
    </div>
  )
}
