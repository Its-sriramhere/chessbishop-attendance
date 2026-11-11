import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Sheet,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import Alert from '../components/Alert'
import PageHeader from '../components/PageHeader'
import { ApiError, api, downloadFile } from '../lib/api'
import { formatPercent, todayISO } from '../lib/format'
import type { AnalyticsData, Batch } from '../lib/types'

const attendanceSheets = [
  'Student Details',
  'Batch Details',
  'Faculty Details',
  'Class Sessions',
  'Attendance Records',
  'Topic Details',
  'Monthly Summary',
  'Batch Attendance Summary',
  'Topic-wise Attendance',
  'Student Risk Analysis',
  'Faculty Performance',
]

const studentSheets = ['Student Details', 'Attendance History']

export default function Reports() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [batchId, setBatchId] = useState('')
  const [summary, setSummary] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'attendance' | 'students' | null>(null)

  useEffect(() => {
    api<{ data: Batch[] }>('/batches')
      .then((response) => setBatches(response.data))
      .catch(() => setBatches([]))
  }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (batchId) params.set('batchId', batchId)
    api<AnalyticsData>(`/analytics/attendance?${params.toString()}`)
      .then((response) => {
        if (active) setSummary(response)
      })
      .catch(() => {
        if (active) setSummary(null)
      })
    return () => {
      active = false
    }
  }, [from, to, batchId])

  const query = () => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (batchId) params.set('batchId', batchId)
    return params.toString()
  }

  const download = async (kind: 'attendance' | 'students') => {
    setDownloading(kind)
    setError(null)
    try {
      const filename =
        kind === 'attendance'
          ? `chessbishop-attendance-${todayISO()}.xlsx`
          : `chessbishop-students-${todayISO()}.xlsx`
      await downloadFile(`/reports/${kind}.xlsx?${query()}`, filename)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to download the workbook')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Excel exports"
        title="Reports"
        description="Download formatted workbooks for record keeping, parent conversations and academy reviews."
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      <div className="card p-3.5 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="report-from">
              From
            </label>
            <input
              id="report-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="report-to">
              To
            </label>
            <input
              id="report-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="report-batch">
              Batch
            </label>
            <select
              id="report-batch"
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className="input"
            >
              <option value="">All batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} ({batch.code})
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Filters apply to both workbooks. Leave the dates empty to export the complete history.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50/80 via-white to-white px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-xl text-ink-900">Attendance & performance workbook</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The complete academy view, across eleven connected sheets.
                </p>
              </div>
              <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">11 sheets</span>
            </div>

            {summary ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                  {summary.totals.students} students
                </span>
                <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                  {summary.totals.sessions} sessions
                </span>
                <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                  {formatPercent(summary.totals.attendance)} attendance
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex-1 px-5 py-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {attendanceSheets.map((sheet) => (
                <div key={sheet} className="flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{sheet}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <button
              onClick={() => download('attendance')}
              disabled={downloading !== null}
              className="btn-primary w-full"
            >
              {downloading === 'attendance' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading === 'attendance' ? 'Building workbook…' : 'Download attendance workbook'}
            </button>
          </div>
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-white px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-900 text-white">
                  <Users className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-xl text-ink-900">Student directory workbook</h2>
                <p className="mt-1 text-sm text-slate-500">
                  A focused roster with each student's full attendance history.
                </p>
              </div>
              <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">2 sheets</span>
            </div>
            {summary ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                  {summary.totals.students} students
                </span>
                <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                  {summary.totals.lowAttendance} below 75%
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex-1 px-5 py-5">
            <div className="space-y-2">
              {studentSheets.map((sheet) => (
                <div key={sheet} className="flex items-center gap-2 text-xs text-slate-600">
                  <Sheet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{sheet}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
              Student details include guardian contacts, level, joining date, batches and attendance percentage.
              The history sheet lists every marked session with topic, trainer, status and remarks.
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <button
              onClick={() => download('students')}
              disabled={downloading !== null}
              className="btn-secondary w-full"
            >
              {downloading === 'students' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading === 'students' ? 'Building workbook…' : 'Download student workbook'}
            </button>
          </div>
        </section>
      </div>

      <div className="card mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-display text-lg text-ink-900">Reporting policy</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            {summary
              ? `${summary.policy.lateCountsAsPresent ? 'Late arrivals count as present' : 'Late arrivals count as absent'}. ${
                  summary.policy.excusedExcluded
                    ? 'Excused absences are excluded from the attendance denominator.'
                    : 'Excused absences are included in the denominator.'
                } Unmarked students are excluded from all totals.`
              : 'Attendance follows the academy policy configured for late and excused records. Unmarked students are excluded from totals.'}
          </p>
        </div>
      </div>
    </div>
  )
}
