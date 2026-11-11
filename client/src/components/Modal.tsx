import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export default function Modal({ open, onClose, title, description, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl text-ink-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  )
}
