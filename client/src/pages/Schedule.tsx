import {
  CalendarDays,
  ClipboardCheck,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, api } from '../lib/api'
import { addDaysISO, formatDate, formatTime, todayISO } from '../lib/format'
import type {
  Batch,
  Faculty,
  SessionStatus,
  SessionSummary,
  Topic,
} from '../lib/types'
import { SESSION_OPTIONS, sessionBadgeClass } from '../lib/ui'

interface SessionForm {
  batchId: string
  date: string
  startTime: string
  endTime: string
  topicId: string
  subtopicId: string
  trainerId: string
  description: string
  objectives: string
  status: SessionStatus
}

function emptyForm(): SessionForm {
  return {
    batchId: '',
    date: todayISO(),
    startTime: '10:00',
    endTime: '11:00',
    topicId: '',
    subtopicId: '',
    trainerId: '',
    description: '',
    objectives: '',
    status: 'SCHEDULED',
  }
}

export default function Schedule() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [batches, setBatches] = useState<Batch[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [from, setFrom] = useState(addDaysISO(-14))
  const [to, setTo] = useState(addDaysISO(30))
  const [batchId, setBatchId] = useState('')
  const [status, setStatus] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SessionSummary | null>(null)
  const [form, setForm] = useState<SessionForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api<{ data: Batch[] }>('/batches').then((response) => setBatches(response.data)),
      api<{ data: Topic[] }>('/topics').then((response) => setTopics(response.data)),
      isAdmin
        ? api<{ data: Faculty[] }>('/faculty').then((response) => setFaculty(response.data))
        : Promise.resolve(),
    ]).catch(() => undefined)
  }, [isAdmin])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (batchId) params.set('batchId', batchId)
    if (status) params.set('status', status)

    api<{ data: SessionSummary[] }>(`/sessions?${params.toString()}`)
      .then((response) => {
        if (active) setSessions(response.data)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to load the schedule')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [from, to, batchId, status, reloadKey])

  const reload = () => setReloadKey((value) => value + 1)

  const subtopicOptions = useMemo(
    () => topics.filter((topic) => topic.parent?.id === form.topicId),
    [topics, form.topicId],
  )

  const updateField = <K extends keyof SessionForm>(key: K, value: SessionForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (session: SessionSummary) => {
    setEditing(session)
    setForm({
      batchId: session.batchId,
      date: session.date.slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      topicId: session.topicId ?? '',
      subtopicId: session.subtopicId ?? '',
      trainerId: session.trainerId,
      description: session.description ?? '',
      objectives: session.objectives ?? '',
      status: session.status,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleBatchChange = (value: string) => {
    setForm((current) => {
      const next = { ...current, batchId: value }
      if (!editing && value) {
        const batch = batches.find((item) => item.id === value)
        if (batch) {
          next.startTime = batch.startTime
          next.endTime = batch.endTime
          next.trainerId = batch.trainer?.id ?? ''
        }
      }
      return next
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError(null)

    const payload = {
      batchId: form.batchId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      topicId: form.topicId || null,
      subtopicId: form.subtopicId || null,
      description: form.description.trim(),
      objectives: form.objectives.trim(),
      status: form.status,
      ...(isAdmin && form.trainerId ? { trainerId: form.trainerId } : {}),
    }

    try {
      if (editing) {
        await api(`/sessions/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setNotice('Class updated successfully.')
      } else {
        await api('/sessions', { method: 'POST', body: JSON.stringify(payload) })
        setNotice('Class scheduled successfully.')
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save the class')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Class timetable"
        title="Class Schedule"
        description="Plan sessions, assign topics and keep the register ready for every batch."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            New class
          </button>
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <Alert tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="card mt-4 p-3.5 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
          <div>
            <label className="label" htmlFor="schedule-from">
              From
            </label>
            <input
              id="schedule-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="schedule-to">
              To
            </label>
            <input
              id="schedule-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="schedule-batch">
              Batch
            </label>
            <select
              id="schedule-batch"
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
            <label className="label" htmlFor="schedule-status">
              Status
            </label>
            <select
              id="schedule-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="input"
            >
              <option value="">All statuses</option>
              {SESSION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button onClick={reload} className="btn-secondary">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4">
          <PageLoader label="Loading the timetable…" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={CalendarDays}
            title="No classes in this range"
            description="Adjust the date range, or schedule a new class for your batch."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="h-4 w-4" />
                Schedule a class
              </button>
            }
          />
        </div>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 md:grid md:grid-cols-[1.1fr_1.3fr_1.1fr_0.9fr_0.8fr_auto] md:items-center md:gap-3">
            <span>Date</span>
            <span>Batch</span>
            <span>Topic</span>
            <span>Trainer</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <li key={session.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-col gap-3 md:grid md:grid-cols-[1.1fr_1.3fr_1.1fr_0.9fr_0.8fr_auto] md:items-center md:gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{formatDate(session.date)}</p>
                    <p className="text-[11px] text-slate-500">
                      {formatTime(session.startTime)} – {formatTime(session.endTime)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{session.batch.name}</p>
                    <p className="text-[11px] text-slate-500">{session.batch.code}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">{session.topic?.name ?? 'No topic'}</p>
                    <p className="text-[11px] text-slate-500">
                      {session.attendanceCount} records marked
                    </p>
                  </div>
                  <div className="hidden text-sm text-slate-600 md:block">{session.trainer.name}</div>
                  <div>
                    <span className={`badge ${sessionBadgeClass(session.status)}`}>{session.status}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {session.status !== 'CANCELLED' ? (
                      <Link
                        to={`/attendance?session=${session.id}`}
                        className="btn-secondary !px-2.5 !py-1.5 text-xs"
                        title="Mark attendance"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Attendance</span>
                      </Link>
                    ) : null}
                    <button
                      onClick={() => openEdit(session)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-700"
                      title="Edit class"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit class' : 'Schedule a class'}
        description={
          editing
            ? 'Update timings, topic, trainer or the session status.'
            : 'Create a session for a batch. Roster and attendance will be ready immediately.'
        }
        wide
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" form="session-form" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule class'}
            </button>
          </div>
        }
      >
        <form id="session-form" onSubmit={submit} className="space-y-4">
          {formError ? <Alert tone="error" message={formError} onDismiss={() => setFormError(null)} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="session-batch">
                Batch
              </label>
              <select
                id="session-batch"
                required
                value={form.batchId}
                onChange={(event) => handleBatchChange(event.target.value)}
                className="input"
              >
                <option value="">Select a batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} ({batch.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="session-date">
                Date
              </label>
              <input
                id="session-date"
                type="date"
                required
                value={form.date}
                onChange={(event) => updateField('date', event.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="session-start">
                Start time
              </label>
              <input
                id="session-start"
                type="time"
                required
                value={form.startTime}
                onChange={(event) => updateField('startTime', event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="session-end">
                End time
              </label>
              <input
                id="session-end"
                type="time"
                required
                value={form.endTime}
                onChange={(event) => updateField('endTime', event.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="session-topic">
                Topic
              </label>
              <select
                id="session-topic"
                value={form.topicId}
                onChange={(event) => {
                  updateField('topicId', event.target.value)
                  updateField('subtopicId', '')
                }}
                className="input"
              >
                <option value="">No topic</option>
                {topics
                  .filter((topic) => !topic.parent)
                  .map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="session-subtopic">
                Subtopic
              </label>
              <select
                id="session-subtopic"
                value={form.subtopicId}
                onChange={(event) => updateField('subtopicId', event.target.value)}
                className="input"
                disabled={subtopicOptions.length === 0}
              >
                <option value="">No subtopic</option>
                {subtopicOptions.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isAdmin ? (
              <div>
                <label className="label" htmlFor="session-trainer">
                  Trainer
                </label>
                <select
                  id="session-trainer"
                  value={form.trainerId}
                  onChange={(event) => updateField('trainerId', event.target.value)}
                  className="input"
                >
                  <option value="">Use batch trainer</option>
                  {faculty
                    .filter((member) => member.isActive)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="label" htmlFor="session-status">
                Status
              </label>
              <select
                id="session-status"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as SessionStatus)}
                className="input"
              >
                {SESSION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="session-description">
              Class notes
            </label>
            <textarea
              id="session-description"
              rows={2}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Optional notes about this session"
              className="input resize-none"
            />
          </div>

          <div>
            <label className="label" htmlFor="session-objectives">
              Learning objectives
            </label>
            <textarea
              id="session-objectives"
              rows={2}
              value={form.objectives}
              onChange={(event) => updateField('objectives', event.target.value)}
              placeholder="What should students walk away knowing?"
              className="input resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
