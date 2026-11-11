import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Save,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '../components/Alert'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, PageLoader } from '../components/PageState'
import { ApiError, api } from '../lib/api'
import { formatDate, formatTime, initials, todayISO } from '../lib/format'
import type { AttendanceStatus, SessionDetailResponse, SessionSummary } from '../lib/types'
import { ATTENDANCE_OPTIONS, levelLabel, sessionBadgeClass, statusLabel } from '../lib/ui'

function shiftDate(value: string, delta: number): string {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + delta)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function statusButtonClass(status: AttendanceStatus, active: boolean): string {
  if (!active) {
    return 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
  }
  switch (status) {
    case 'PRESENT':
      return 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
    case 'ABSENT':
      return 'border-red-500 bg-red-500 text-white shadow-sm shadow-red-500/20'
    case 'LATE':
      return 'border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-500/20'
    case 'EXCUSED':
      return 'border-violet-500 bg-violet-500 text-white shadow-sm shadow-violet-500/20'
  }
}

export default function Attendance() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [date, setDate] = useState(todayISO())
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('session'))
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({})
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setSessionsLoading(true)
    api<{ data: SessionSummary[] }>(`/sessions?from=${date}&to=${date}`)
      .then((response) => {
        if (!active) return
        setSessions(response.data)
        setSelectedId((current) => current ?? response.data[0]?.id ?? null)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof ApiError ? err.message : 'Unable to load sessions')
      })
      .finally(() => {
        if (active) setSessionsLoading(false)
      })
    return () => {
      active = false
    }
  }, [date])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let active = true
    setDetailLoading(true)
    api<SessionDetailResponse>(`/sessions/${selectedId}`)
      .then((response) => {
        if (!active) return
        setDetail(response)
        const nextStatuses: Record<string, AttendanceStatus> = {}
        const nextRemarks: Record<string, string> = {}
        for (const entry of response.roster) {
          nextStatuses[entry.student.id] = entry.attendance?.status ?? 'PRESENT'
          nextRemarks[entry.student.id] = entry.attendance?.remarks ?? ''
        }
        setStatuses(nextStatuses)
        setRemarks(nextRemarks)
        setDirty(false)
        setNotice(null)
        setError(null)
        const sessionDate = response.session.date.slice(0, 10)
        setDate((current) => (current === sessionDate ? current : sessionDate))
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof ApiError ? err.message : 'Unable to load this class')
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const selectSession = (id: string) => {
    setSelectedId(id)
    setSearchParams({ session: id }, { replace: true })
    setNotice(null)
    setError(null)
  }

  const changeDate = (value: string) => {
    setDate(value)
    setSelectedId(null)
    setDetail(null)
    setSearchParams({}, { replace: true })
    setNotice(null)
  }

  const roster = detail?.roster ?? []

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    for (const entry of roster) {
      const status = statuses[entry.student.id]
      if (status) result[status] += 1
    }
    return result
  }, [roster, statuses])

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((current) => ({ ...current, [studentId]: status }))
    setDirty(true)
    setNotice(null)
  }

  const setRemark = (studentId: string, value: string) => {
    setRemarks((current) => ({ ...current, [studentId]: value }))
    setDirty(true)
  }

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {}
    for (const entry of roster) next[entry.student.id] = status
    setStatuses(next)
    setDirty(true)
    setNotice(null)
  }

  const reset = () => {
    if (!detail) return
    const nextStatuses: Record<string, AttendanceStatus> = {}
    const nextRemarks: Record<string, string> = {}
    for (const entry of detail.roster) {
      nextStatuses[entry.student.id] = entry.attendance?.status ?? 'PRESENT'
      nextRemarks[entry.student.id] = entry.attendance?.remarks ?? ''
    }
    setStatuses(nextStatuses)
    setRemarks(nextRemarks)
    setDirty(false)
    setNotice(null)
  }

  const refreshSessions = async (day: string) => {
    const response = await api<{ data: SessionSummary[] }>(`/sessions?from=${day}&to=${day}`)
    setSessions(response.data)
  }

  const save = async () => {
    if (!selectedId || !detail) return
    const records = detail.roster.map((entry) => ({
      studentId: entry.student.id,
      status: statuses[entry.student.id] ?? 'PRESENT',
      remarks: remarks[entry.student.id]?.trim() || null,
    }))

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await api(`/sessions/${selectedId}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ records, status: 'COMPLETED' }),
      })
      const refreshed = await api<SessionDetailResponse>(`/sessions/${selectedId}`)
      setDetail(refreshed)
      const nextStatuses: Record<string, AttendanceStatus> = {}
      const nextRemarks: Record<string, string> = {}
      for (const entry of refreshed.roster) {
        nextStatuses[entry.student.id] = entry.attendance?.status ?? 'PRESENT'
        nextRemarks[entry.student.id] = entry.attendance?.remarks ?? ''
      }
      setStatuses(nextStatuses)
      setRemarks(nextRemarks)
      setDirty(false)
      setNotice(`Attendance saved for ${records.length} ${records.length === 1 ? 'student' : 'students'}.`)
      await refreshSessions(date)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const cancelled = detail?.session.status === 'CANCELLED'

  return (
    <div>
      <PageHeader
        eyebrow="Daily register"
        title="Attendance"
        description="Pick a class, mark the roster and save. Attendance feeds every report and analytics view."
        actions={
          <>
            <button
              onClick={() => {
                void refreshSessions(date)
              }}
              className="btn-secondary"
            >
              Refresh
            </button>
            {user?.role === 'ADMIN' ? (
              <Link to="/attendance/import" className="btn-secondary">
                <Upload className="h-4 w-4" />
                Import previous
              </Link>
            ) : null}
            <Link to="/schedule" className="btn-primary">
              <CalendarDays className="h-4 w-4" />
              Schedule class
            </Link>
          </>
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <Alert tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <label className="label" htmlFor="date">
              Class date
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeDate(shiftDate(date, -1))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(event) => changeDate(event.target.value || todayISO())}
                className="input flex-1 !py-2 text-sm"
              />
              <button
                onClick={() => changeDate(shiftDate(date, 1))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={() => changeDate(todayISO())}
              className="mt-2 text-[11px] font-bold uppercase tracking-wide text-brand-600 hover:text-brand-700"
            >
              Jump to today
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-ink-900">Classes</h2>
              <span className="badge bg-slate-100 text-slate-600">{sessions.length}</span>
            </div>
            {sessionsLoading ? (
              <div className="p-4">
                <PageLoader label="Loading classes…" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={CalendarDays}
                  title="No classes on this date"
                  description="Choose another date or schedule a new class."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sessions.map((session) => {
                  const active = session.id === selectedId
                  return (
                    <li key={session.id}>
                      <button
                        onClick={() => selectSession(session.id)}
                        className={`w-full px-4 py-3 text-left transition ${
                          active ? 'bg-brand-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-ink-900">{formatTime(session.startTime)}</p>
                          <span className={`badge ${sessionBadgeClass(session.status)}`}>{session.status}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-700">{session.batch.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {session.topic?.name ?? 'No topic'} · {session.trainer.name}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                          {session.attendanceCount} attendance records
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {detailLoading ? (
            <PageLoader label="Loading roster…" />
          ) : !selectedId ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Select a class to mark attendance"
              description="Choose a class from the list, or schedule a new one for this date."
              action={
                <Link to="/schedule" className="btn-primary">
                  <CalendarDays className="h-4 w-4" />
                  Schedule a class
                </Link>
              }
            />
          ) : !detail ? (
            <PageLoader label="Preparing roster…" />
          ) : (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50/70 via-white to-white px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl text-ink-900">{detail.session.batch.name}</h2>
                      <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                        {detail.session.batch.code}
                      </span>
                      <span className={`badge ${sessionBadgeClass(detail.session.status)}`}>
                        {detail.session.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {formatDate(detail.session.date, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}{' '}
                      · {formatTime(detail.session.startTime)} – {formatTime(detail.session.endTime)}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {detail.session.topic?.name ?? 'No topic assigned'} · Trainer {detail.session.trainer.name}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Roster</p>
                    <p className="text-lg font-bold text-ink-900">{roster.length}</p>
                  </div>
                </div>

                {detail.session.objectives ? (
                  <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
                    <span className="font-bold text-slate-700">Objectives: </span>
                    {detail.session.objectives}
                  </p>
                ) : null}
              </div>

              {cancelled ? (
                <div className="p-5">
                  <Alert tone="error" message="This class was cancelled. Attendance cannot be recorded for a cancelled session." />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-emerald-50 text-emerald-700">Present {counts.PRESENT}</span>
                      <span className="badge bg-red-50 text-red-700">Absent {counts.ABSENT}</span>
                      <span className="badge bg-amber-50 text-amber-700">Late {counts.LATE}</span>
                      <span className="badge bg-violet-50 text-violet-700">Excused {counts.EXCUSED}</span>
                      {roster.length - Object.values(counts).reduce((sum, value) => sum + value, 0) > 0 ? (
                        <span className="badge bg-slate-100 text-slate-600">
                          Unmarked {roster.length - Object.values(counts).reduce((sum, value) => sum + value, 0)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => markAll('PRESENT')} className="btn-secondary !py-1.5 text-xs">
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all present
                      </button>
                      <button onClick={() => markAll('ABSENT')} className="btn-secondary !py-1.5 text-xs">
                        Mark all absent
                      </button>
                      <button onClick={reset} className="btn-ghost !py-1.5 text-xs" disabled={!dirty}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </button>
                      {dirty ? (
                        <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-amber-600">
                          Unsaved changes
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {roster.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        icon={Users}
                        title="No students in this batch"
                        description="Add students to the batch before recording attendance."
                        action={
                          <Link to="/students" className="btn-primary">
                            Manage students
                          </Link>
                        }
                      />
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {roster.map((entry) => {
                        const status = statuses[entry.student.id] ?? 'PRESENT'
                        return (
                          <li key={entry.student.id} className="px-4 py-3.5 sm:px-6">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                              <div className="flex min-w-0 items-center gap-3 lg:w-[32%]">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                                  {initials(entry.student.name)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-ink-900">
                                    {entry.student.name}
                                    {entry.student.status === 'INACTIVE' ? (
                                      <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Inactive</span>
                                    ) : null}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {entry.student.studentCode} · {levelLabel(entry.student.level)}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
                                {ATTENDANCE_OPTIONS.map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => setStatus(entry.student.id, option.value)}
                                    className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition sm:px-2.5 sm:text-[11px] ${statusButtonClass(
                                      option.value,
                                      status === option.value,
                                    )}`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>

                              <div className="flex-1">
                                <input
                                  value={remarks[entry.student.id] ?? ''}
                                  onChange={(event) => setRemark(entry.student.id, event.target.value)}
                                  placeholder="Optional remark"
                                  className="input !py-1.5 text-xs"
                                />
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur sm:flex-row sm:items-center sm:px-6">
                    <p className="flex-1 text-[11px] leading-relaxed text-slate-500">
                      <span className="font-semibold text-slate-600">{statusLabel(detail.session.status)}</span>
                      {' · '}
                      {detail.policy?.lateCountsAsPresent
                        ? 'Late arrivals count as present.'
                        : 'Late arrivals count as absent.'}
                      {detail.policy?.excusedExcluded
                        ? ' Excused absences are excluded from totals.'
                        : ''}{' '}
                      Unmarked students are excluded from reports.
                    </p>
                    <button
                      onClick={save}
                      disabled={saving || roster.length === 0}
                      className="btn-primary shrink-0"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving…' : 'Save attendance'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
