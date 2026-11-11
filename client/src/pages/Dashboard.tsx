import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import StatCard from '../components/StatCard'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, api } from '../lib/api'
import { actionLabel, formatPercent, formatTime } from '../lib/format'
import type { DashboardData } from '../lib/types'
import { riskDotClass, sessionBadgeClass } from '../lib/ui'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function barColor(value: number | null): string {
  if (value === null) return 'bg-slate-300'
  if (value >= 90) return 'bg-emerald-500'
  if (value >= 75) return 'bg-sky-500'
  if (value >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const firstName = user?.name.split(' ')[0] ?? 'there'

  return (
    <div>
      <PageHeader
        eyebrow={user?.role === 'ADMIN' ? 'Academy overview' : 'Faculty overview'}
        title={`${greeting()}, ${firstName}`}
        description={
          user?.role === 'ADMIN'
            ? 'Here is how attendance and classes are tracking across the academy today.'
            : 'Here is how your batches are tracking today.'
        }
        actions={
          <>
            <button onClick={load} className="btn-secondary">
              Refresh
            </button>
            <Link to="/attendance" className="btn-primary">
              <ClipboardCheck className="h-4 w-4" />
              Mark attendance
            </Link>
          </>
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      {loading || !data ? (
        <PageLoader label="Loading academy snapshot…" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active students"
              value={data.stats.totalStudents}
              hint={`${data.stats.activeBatches} active batches`}
              icon={Users}
              tone="brand"
            />
            <StatCard
              label="Overall attendance"
              value={formatPercent(data.stats.overallAttendance)}
              hint={`${data.stats.sessionsRecorded} completed sessions`}
              icon={BarChart3}
              tone={
                data.stats.overallAttendance === null
                  ? 'slate'
                  : data.stats.overallAttendance >= 75
                    ? 'emerald'
                    : 'amber'
              }
            />
            <StatCard
              label="Today's classes"
              value={data.stats.todayClasses}
              hint={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              icon={CalendarDays}
              tone="sky"
            />
            <StatCard
              label="Low attendance"
              value={data.stats.lowAttendance}
              hint="Students below 75%"
              icon={AlertTriangle}
              tone="red"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <section className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="font-display text-lg text-ink-900">Attendance by batch</h2>
                    <p className="text-xs text-slate-500">Completed sessions, all time</p>
                  </div>
                  <Link
                    to="/analytics"
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand-600 hover:text-brand-700"
                  >
                    View analytics <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Students</th>
                        <th>Sessions</th>
                        <th className="w-[38%]">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.batchAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                            No completed sessions yet.
                          </td>
                        </tr>
                      ) : (
                        data.batchAttendance.map((batch) => (
                          <tr key={batch.id}>
                            <td>
                              <p className="font-semibold text-ink-900">{batch.name}</p>
                              <p className="text-xs text-slate-500">{batch.code}</p>
                            </td>
                            <td>{batch.students}</td>
                            <td>{batch.sessions}</td>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${barColor(batch.attendance)}`}
                                    style={{ width: `${batch.attendance ?? 0}%` }}
                                  />
                                </div>
                                <span className="w-14 text-right text-sm font-bold text-ink-900">
                                  {formatPercent(batch.attendance)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="font-display text-lg text-ink-900">Today's classes</h2>
                    <p className="text-xs text-slate-500">Sessions scheduled for today</p>
                  </div>
                  <Link
                    to="/schedule"
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand-600 hover:text-brand-700"
                  >
                    Full schedule <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {data.todaySessions.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      icon={CalendarDays}
                      title="No classes today"
                      description="There are no sessions scheduled for today. You can create one from the class schedule."
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.todaySessions.map((session) => (
                      <li
                        key={session.id}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                      >
                        <div className="w-24 shrink-0">
                          <p className="text-sm font-bold text-ink-900">{formatTime(session.startTime)}</p>
                          <p className="text-[11px] text-slate-500">to {formatTime(session.endTime)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink-900">{session.batch.name}</p>
                            <span className={`badge ${sessionBadgeClass(session.status)}`}>
                              {session.status}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {session.topic?.name ?? 'No topic assigned'} · {session.trainer.name} ·{' '}
                            {session.attendanceCount} records
                          </p>
                        </div>
                        <Link
                          to={`/attendance?session=${session.id}`}
                          className="btn-secondary shrink-0 !py-2 text-xs"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Attendance
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-ink-900">Attendance risk</h2>
                  <span className="text-xs font-semibold text-slate-500">
                    {data.stats.totalStudents} students
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Excellent', value: data.risk.excellent, risk: 'Excellent' as const, hint: '90–100%' },
                    { label: 'Good', value: data.risk.good, risk: 'Good' as const, hint: '75–89%' },
                    { label: 'At risk', value: data.risk.atRisk, risk: 'At Risk' as const, hint: '50–74%' },
                    { label: 'Critical', value: data.risk.critical, risk: 'Critical' as const, hint: 'Below 50%' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${riskDotClass(item.risk)}`} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.hint}</p>
                      </div>
                      <span className="text-lg font-bold text-ink-900">{item.value}</span>
                    </div>
                  ))}
                  {data.risk.noData > 0 ? (
                    <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <p className="flex-1 text-sm font-semibold text-slate-500">No data yet</p>
                      <span className="text-lg font-bold text-slate-500">{data.risk.noData}</span>
                    </div>
                  ) : null}
                </div>
                <Link to="/analytics" className="btn-secondary mt-5 w-full !py-2 text-xs">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Open analytics
                </Link>
              </section>

              <section className="card p-5 sm:p-6">
                <h2 className="font-display text-lg text-ink-900">Quick actions</h2>
                <div className="mt-4 space-y-2">
                  {[
                    { to: '/attendance', label: 'Record attendance', icon: ClipboardCheck },
                    { to: '/students', label: 'Browse students', icon: Users },
                    { to: '/reports', label: 'Download Excel report', icon: FileSpreadsheet },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-700"
                    >
                      <item.icon className="h-4 w-4 text-brand-600" />
                      <span className="flex-1">{item.label}</span>
                      <ArrowUpRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </section>

              <section className="card p-5 sm:p-6">
                <h2 className="font-display text-lg text-ink-900">Recent activity</h2>
                {data.recentActivity.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No activity recorded yet.</p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {data.recentActivity.map((entry) => (
                      <li key={entry.id} className="flex gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                          <Activity className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-700">{actionLabel(entry.action)}</p>
                          <p className="text-[11px] text-slate-500">
                            {entry.actor?.name ?? 'System'} · {entry.entity} · {timeAgo(entry.createdAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
