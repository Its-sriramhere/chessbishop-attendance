import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const tones = {
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
  error: { wrap: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle },
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Info },
}

export default function Alert({
  tone = 'info',
  message,
  onDismiss,
}: {
  tone?: keyof typeof tones
  message: string
  onDismiss?: () => void
}) {
  const { wrap, Icon } = tones[tone]
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${wrap}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{message}</p>
      {onDismiss ? (
        <button onClick={onDismiss} className="shrink-0 opacity-60 transition hover:opacity-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
