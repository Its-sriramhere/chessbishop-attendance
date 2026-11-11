import { BarChart3, ClipboardCheck, FileSpreadsheet, Loader2, LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../lib/api'

export default function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemo = (role: 'admin' | 'faculty') => {
    if (role === 'admin') {
      setEmail('admin@chessbishop.in')
      setPassword('Admin@123')
    } else {
      setEmail('aravind@chessbishop.in')
      setPassword('Coach@123')
    }
    setError(null)
  }

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.05fr_1fr]">
      <section
        className="relative hidden overflow-hidden px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{
          background:
            'radial-gradient(120% 80% at 0% 0%, #1a2d55 0%, #0a1029 55%, #060a1f 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/chessbishop-emblem.png"
            alt="ChessBishop"
            className="h-12 w-12 rounded-xl bg-white/5 object-cover ring-1 ring-white/15"
          />
          <div>
            <p className="font-display text-xl leading-tight text-white">ChessBishop</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-brand-300">Academy OS</p>
          </div>
        </div>

        <div className="max-w-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-300">
            Smart academy management
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-white xl:text-5xl">
            Every class, every topic, every student — in one place.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            Record topic-based attendance, follow learning progress and download
            audit-ready Excel reports for your whole academy.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: ClipboardCheck, title: 'Manual attendance in seconds', text: 'Batch rosters load automatically. Mark all present, adjust exceptions and save.' },
              { icon: BarChart3, title: 'Attendance that tells a story', text: 'Batch, topic, monthly and risk analytics update the moment attendance is saved.' },
              { icon: FileSpreadsheet, title: 'Excel reports, ready to share', text: 'Eleven formatted sheets covering students, faculty, schedules and performance.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-brand-300 ring-1 ring-white/10">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500">ChessBishop Private LLP · Academy operations platform</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src="/chessbishop-emblem.png"
              alt="ChessBishop"
              className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200"
            />
            <div>
              <p className="font-display text-lg leading-tight text-ink-900">ChessBishop</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-600">Academy OS</p>
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">Welcome back</p>
          <h2 className="mt-1.5 font-display text-3xl text-ink-900">Sign in to your academy</h2>
          <p className="mt-2 text-sm text-slate-500">
            Use your Administrator or Faculty account to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}

            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@chessbishop.in"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Demo accounts</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => fillDemo('admin')}
                className="rounded-xl border border-brand-200/70 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
              >
                <p className="text-xs font-bold text-ink-900">Administrator</p>
                <p className="mt-0.5 text-[11px] text-slate-500">admin@chessbishop.in / Admin@123</p>
              </button>
              <button
                type="button"
                onClick={() => fillDemo('faculty')}
                className="rounded-xl border border-brand-200/70 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
              >
                <p className="text-xs font-bold text-ink-900">Faculty</p>
                <p className="mt-0.5 text-[11px] text-slate-500">aravind@chessbishop.in / Coach@123</p>
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Faculty accounts: aravind, lakshmi, senthil, meera — all use Coach@123.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
