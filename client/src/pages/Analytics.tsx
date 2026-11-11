import {
  AlertTriangle,
  CalendarCheck,
  Download,
  Loader2,
  Percent,
  RotateCcw,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import StatCard from '../components/StatCard'
import { ApiError, api, downloadFile } from '../lib/api'
import { formatPercent, todayISO } from '../lib/format'
import type { AnalyticsData, Batch, Topic } from '../lib/types'
import { attendanceTone, riskBadgeClass, riskDotClass } from '../lib/ui'

function barColor(value: number | null): string {
  if (value === null) return 'bg-slate-300'
  if (value >= 90) return 'bg-emerald-500'
  if (value >= 75) return 'bg-sky-500'
  if (value >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function Analytics() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [batchId, setBatchId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([
      api<{ data: Batch[] }>('/batches').then((response) => setBatches(response.data)),
      api<{ data: Topic[] }>('/topics').then((response) => setTopics(response.data)),
    ]).catch(() => undefined)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (batchId) params.set('batchId', batchId)
    if (topicId) params.set('topicId', topicId)

    api<AnalyticsData>(`/analytics/attendance?${params.toString()}`)
      .then((response) => {
        if (active) setData(response)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to load analytics')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [from, to, batchId, topicId])

  const hasFilters = Boolean(from || to || batchId || topicId)

  const clearFilters = () => {
    setFrom('')
    setTo('')
    setBatchId('')
    setTopicId('')
  }

  const download = async () => {
    setDownloading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (batchId) params.set('batchId', batchId)
      await downloadFile(`/reports/attendance.xlsx?${params.toString()}`, `chessbishop-attendance-${todayISO()}.xlsx`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to download report')
    } finally {
      setDownloading(false)
    }
  }

  const months = data?.monthly.slice(-12) ?? []
  const topicRows = data?.topicStats.slice(0, 8) ?? []
  const totalRisk = data
    ? data.risk.excellent + data.risk.good + data.risk.atRisk + data.risk.critical + data.risk.noData
    : 0

  return (
    <div>
      <PageHeader
        eyebrow="Attendance intelligence"
        title="Analytics"
        description="Filter by date, batch or topic to understand where attendance is strong and where students need support."
        actions={
          <button onClick={download} disabled={downloading} className="btn-primary">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? 'Preparing…' : 'Download Excel'}
          </button>
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      <div className="card mt-4 p-3.5 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
          <div>
            <label className="label" htmlFor="analytics-from">
              From
            </label>
            <input
              id="analytics-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="analytics-to">
              To
            </label>
            <input
              id="analytics-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="analytics-batch">
              Batch
            </label>
            <select
              id="analytics-batch"
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className="input"
            >
              <option value="">All batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="analytics-topic">
              Topic
            </label>
            <select
              id="analytics-topic"
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
              className="input"
            >
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={clearFilters} disabled={!hasFilters} className="btn-secondary">
            <RotateCcw className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="mt-4">
          <PageLoader label="Crunching attendance data…" />
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Overall attendance"
              value={formatPercent(data.totals.attendance)}
              hint={`${data.totals.attended} attended of ${data.totals.eligible} marked`}
              icon={Percent}
              tone={attendanceTone(data.totals.attendance)}
            />
            <StatCard
              label="Students tracked"
              value={data.totals.students}
              hint={`${data.totals.lowAttendance} below 75%`}
              icon={Users}
              tone="brand"
            />
            <StatCard
              label="Sessions completed"
              value={data.totals.sessions}
              hint={`${data.totals.absent} absences · ${data.totals.late} late`}
              icon={CalendarCheck}
              tone="sky"
            />
            <StatCard
              label="Excused absences"
              value={data.totals.excused}
              hint={data.policy.excusedExcluded ? 'Excluded from denominator' : 'Included in denominator'}
              icon={AlertTriangle}
              tone="amber"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="card p-5 sm:p-6 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg text-ink-900">Monthly attendance trend</h2>
                  <p className="text-xs text-slate-500">Last 12 months in the selected range</p>
                </div>
              </div>
              {months.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={CalendarCheck}
                    title="No completed sessions"
                    description="Adjust the filters or record attendance to see the monthly trend."
                  />
                </div>
              ) : (
                <div className="mt-6 flex h-48 items-end gap-2 overflow-x-auto pb-1">
                  {months.map((month) => (
                    <div key={month.key} className="flex h-full min-w-[44px] flex-1 flex-col justify-end">
                      <div className="flex flex-1 items-end">
                        <div
                          className={`w-full rounded-t-lg transition hover:opacity-80 ${barColor(month.attendance)}`}
                          style={{ height: `${Math.max(4, month.attendance ?? 0)}%` }}
                          title={`${month.label}: ${formatPercent(month.attendance)} (${month.sessions} sessions)`}
                        />
                      </div>
                      <p className="mt-1.5 truncate text-center text-[10px] font-semibold text-slate-500">
                        {month.label.split(' ')[0]}
                      </p>
                      <p className="text-center text-[10px] font-bold text-ink-900">
                        {formatPercent(month.attendance)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-ink-900">Risk distribution</h2>
                <span className="text-xs font-semibold text-slate-500">{totalRisk} students</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Excellent', hint: '90–100%', value: data.risk.excellent, risk: 'Excellent' as const },
                  { label: 'Good', hint: '75–89%', value: data.risk.good, risk: 'Good' as const },
                  { label: 'At risk', hint: '50–74%', value: data.risk.atRisk, risk: 'At Risk' as const },
                  { label: 'Critical', hint: 'Below 50%', value: data.risk.critical, risk: 'Critical' as const },
                  { label: 'No data', hint: 'Not marked yet', value: data.risk.noData, risk: 'No Data' as const },
                ].map((item) => {
                  const share = totalRisk > 0 ? Math.round((item.value / totalRisk) * 100) : 0
                  return (
                    <div key={item.label}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${riskDotClass(item.risk)}`} />
                        <p className="flex-1 text-sm font-semibold text-slate-700">{item.label}</p>
                        <span className="text-sm font-bold text-ink-900">{item.value}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 pl-4.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${riskDotClass(item.risk)}`} style={{ width: `${share}%` }} />
                        </div>
                        <span className="w-8 text-right text-[10px] font-semibold text-slate-400">{share}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-display text-lg text-ink-900">Batch performance</h2>
                <p className="text-xs text-slate-500">Attendance by batch in this range</p>
              </div>
              {data.batchStats.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={Users} title="No batch data" description="No completed sessions match these filters." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Students</th>
                        <th>Sessions</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.batchStats.map((batch) => (
                        <tr key={batch.id}>
                          <td>
                            <p className="font-semibold text-ink-900">{batch.name}</p>
                            <p className="text-[11px] text-slate-500">{batch.code}</p>
                          </td>
                          <td>{batch.students}</td>
                          <td>{batch.sessions}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full ${barColor(batch.attendance)}`} style={{ width: `${batch.attendance ?? 0}%` }} />
                              </div>
                              <span className="text-sm font-bold text-ink-900">{formatPercent(batch.attendance)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-display text-lg text-ink-900">Topic performance</h2>
                <p className="text-xs text-slate-500">Most taught topics by session count</p>
              </div>
              {topicRows.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={CalendarCheck} title="No topic data" description="No completed sessions match these filters." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Category</th>
                        <th>Sessions</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topicRows.map((topic) => (
                        <tr key={topic.id}>
                          <td className="font-semibold text-slate-700">{topic.name}</td>
                          <td className="text-slate-500">{topic.category}</td>
                          <td>{topic.sessions}</td>
                          <td className="font-bold text-ink-900">{formatPercent(topic.attendance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-display text-lg text-ink-900">Students needing support</h2>
                <p className="text-xs text-slate-500">Below 75% attendance in this range</p>
              </div>
              <Link to="/students" className="text-xs font-bold uppercase tracking-wide text-brand-600 hover:text-brand-700">
                All students
              </Link>
            </div>
            {data.lowAttendance.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Users}
                  title="Everyone is above 75%"
                  description="No students fall below the attendance threshold for these filters."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Batch</th>
                      <th>Attendance</th>
                      <th>Absent</th>
                      <th>Late</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowAttendance.slice(0, 12).map((student) => (
                      <tr key={student.id}>
                        <td>
                          <Link to={`/students/${student.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                            {student.name}
                          </Link>
                          <p className="text-[11px] text-slate-500">{student.code}</p>
                        </td>
                        <td>{student.batches.join(', ') || '—'}</td>
                        <td className="font-bold text-ink-900">{formatPercent(student.attendance)}</td>
                        <td>{student.absent}</td>
                        <td>{student.late}</td>
                        <td>
                          <span className={`badge ${riskBadgeClass(student.risk)}`}>{student.risk}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
