import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Mail,
  Percent,
  Phone,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../components/Alert'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import StatCard from '../components/StatCard'
import { ApiError, api } from '../lib/api'
import { formatDate, formatPercent, initials } from '../lib/format'
import type { StudentDetailResponse } from '../lib/types'
import { attendanceBadgeClass, levelLabel, riskBadgeClass } from '../lib/ui'

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<StudentDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setError(null)
    api<StudentDetailResponse>(`/students/${id}`)
      .then((response) => {
        if (active) setData(response)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to load student')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const history = useMemo(() => {
    if (!data) return []
    if (!statusFilter) return data.history
    return data.history.filter((record) => record.status === statusFilter)
  }, [data, statusFilter])

  if (loading) return <PageLoader label="Loading student profile…" />

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Student profile" />
        <Alert tone="error" message={error ?? 'Student not found'} />
        <Link to="/students" className="btn-secondary mt-4">
          <ArrowLeft className="h-4 w-4" />
          Back to students
        </Link>
      </div>
    )
  }

  const { student, stats } = data

  return (
    <div>
      <Link
        to="/students"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 transition hover:text-brand-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All students
      </Link>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50/80 via-white to-white px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white font-display text-xl text-brand-700 ring-1 ring-brand-100">
              {initials(student.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl text-ink-900">{student.name}</h1>
                <span className={`badge ${riskBadgeClass(stats?.risk ?? 'No Data')}`}>
                  {stats?.risk ?? 'No Data'}
                </span>
                {student.status === 'INACTIVE' ? (
                  <span className="badge bg-slate-100 text-slate-600">Inactive</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {student.studentCode} · {levelLabel(student.level)} · Joined {formatDate(student.joiningDate)}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 text-slate-400" />
                  {student.guardianName ?? 'Guardian not recorded'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {student.contact ?? 'No contact'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {student.email ?? 'No email'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                  DOB {formatDate(student.dob)}
                </span>
              </div>
            </div>
            <Link to="/attendance" className="btn-secondary shrink-0">
              Mark attendance
            </Link>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <StatCard
            label="Attendance"
            value={formatPercent(stats?.attendance ?? null)}
            hint={`${stats?.eligible ?? 0} eligible sessions`}
            icon={Percent}
            tone={stats?.attendance !== null && stats?.attendance !== undefined && stats.attendance < 75 ? 'amber' : 'emerald'}
          />
          <StatCard
            label="Attended"
            value={stats?.attended ?? 0}
            hint={`Denominator ${stats?.denominator ?? 0}`}
            icon={CheckCircle2}
            tone="sky"
          />
          <StatCard
            label="Absences"
            value={stats?.absent ?? 0}
            hint={`${stats?.excused ?? 0} excused · ${stats?.unmarked ?? 0} unmarked`}
            icon={XCircle}
            tone="red"
          />
          <StatCard
            label="Late arrivals"
            value={stats?.late ?? 0}
            hint="Counted per academy policy"
            icon={AlertTriangle}
            tone="amber"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="card overflow-hidden lg:self-start">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg text-ink-900">Batch membership</h2>
            <p className="text-xs text-slate-500">Active and previous batches</p>
          </div>
          {data.batches.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Users} title="No batches" description="This student has not been assigned to a batch." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.batches.map((batch) => (
                <li key={`${batch.id}-${batch.assignedAt}`} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{batch.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {batch.code} · {levelLabel(batch.level)}
                      </p>
                    </div>
                    {batch.endedAt ? (
                      <span className="badge bg-slate-100 text-slate-500">Ended</span>
                    ) : (
                      <span className="badge bg-emerald-50 text-emerald-700">Active</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {batch.trainer?.name ?? 'No trainer'} · from {formatDate(batch.assignedAt)}
                    {batch.endedAt ? ` to ${formatDate(batch.endedAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg text-ink-900">Attendance history</h2>
              <p className="text-xs text-slate-500">{data.history.length} recorded sessions</p>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input !py-2 text-xs sm:w-40"
            >
              <option value="">All statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="EXCUSED">Excused</option>
            </select>
          </div>

          {history.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={CalendarDays}
                title="No attendance records"
                description="Attendance will appear here once classes are marked for this student."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch</th>
                    <th>Topic</th>
                    <th>Trainer</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td className="whitespace-nowrap font-semibold text-slate-700">{formatDate(record.date)}</td>
                      <td className="whitespace-nowrap">{record.batch.code}</td>
                      <td>
                        <p className="max-w-[220px] truncate text-slate-700">{record.topic?.name ?? '—'}</p>
                        {record.topic?.category ? (
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">{record.topic.category}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap">{record.trainer.name}</td>
                      <td>
                        <span className={`badge ${attendanceBadgeClass(record.status)}`}>{record.status}</span>
                      </td>
                      <td className="max-w-[240px] truncate text-slate-500">{record.remarks ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
