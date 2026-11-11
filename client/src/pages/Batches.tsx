import { CalendarDays, Layers3, Loader2, Pencil, Plus, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, api } from '../lib/api'
import { formatTime } from '../lib/format'
import type { Batch, Faculty, Level } from '../lib/types'
import { DAY_OPTIONS, LEVEL_OPTIONS, levelLabel } from '../lib/ui'

interface BatchForm {
  name: string
  code: string
  level: Level
  days: string[]
  startTime: string
  endTime: string
  trainerId: string
  isActive: boolean
}

function emptyForm(): BatchForm {
  return {
    name: '',
    code: '',
    level: 'BEGINNER',
    days: [],
    startTime: '10:00',
    endTime: '11:00',
    trainerId: '',
    isActive: true,
  }
}

export default function Batches() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [batches, setBatches] = useState<Batch[]>([])
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)
  const [form, setForm] = useState<BatchForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api<{ data: Batch[] }>('/batches')
      .then((response) => setBatches(response.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load batches'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    if (isAdmin) {
      api<{ data: Faculty[] }>('/faculty')
        .then((response) => setFaculty(response.data))
        .catch(() => setFaculty([]))
    }
  }, [isAdmin])

  const updateField = <K extends keyof BatchForm>(key: K, value: BatchForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const toggleDay = (day: string) => {
    setForm((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((value) => value !== day)
        : [...current.days, day],
    }))
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (batch: Batch) => {
    setEditing(batch)
    setForm({
      name: batch.name,
      code: batch.code,
      level: batch.level,
      days: batch.days,
      startTime: batch.startTime,
      endTime: batch.endTime,
      trainerId: batch.trainer?.id ?? '',
      isActive: batch.isActive,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.days.length === 0) {
      setFormError('Select at least one class day.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      level: form.level,
      days: form.days,
      startTime: form.startTime,
      endTime: form.endTime,
      trainerId: form.trainerId || null,
      isActive: form.isActive,
    }
    try {
      if (editing) {
        await api(`/batches/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setNotice(`${payload.name} updated.`)
      } else {
        await api('/batches', { method: 'POST', body: JSON.stringify(payload) })
        setNotice(`${payload.name} created.`)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save the batch')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Academy structure"
        title="Batches"
        description={
          isAdmin
            ? 'Group students by level and schedule, then assign a trainer to each batch.'
            : 'The batches assigned to you, including schedules and rosters.'
        }
        actions={
          isAdmin ? (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              New batch
            </button>
          ) : undefined
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <Alert tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      {loading ? (
        <div className="mt-4">
          <PageLoader label="Loading batches…" />
        </div>
      ) : batches.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Layers3}
            title="No batches yet"
            description="Create a batch to start assigning students and scheduling classes."
            action={
              isAdmin ? (
                <button onClick={openCreate} className="btn-primary">
                  <Plus className="h-4 w-4" />
                  Create the first batch
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((batch) => (
            <section key={batch.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-brand-50 text-brand-700">{batch.code}</span>
                    <span className="badge bg-slate-100 text-slate-600">{levelLabel(batch.level)}</span>
                    {!batch.isActive ? <span className="badge bg-red-50 text-red-700">Inactive</span> : null}
                  </div>
                  <h2 className="mt-2 font-display text-lg leading-tight text-ink-900">{batch.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {batch.trainer?.name ?? 'No trainer assigned'}
                  </p>
                </div>
                {isAdmin ? (
                  <button
                    onClick={() => openEdit(batch)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-700"
                    title="Edit batch"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                  <span>{batch.daysLabel || 'No days set'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Layers3 className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {formatTime(batch.startTime)} – {formatTime(batch.endTime)} · {batch.durationMin} min
                  </span>
                </p>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <Users className="h-3 w-3" /> Students
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink-900">{batch.studentCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <CalendarDays className="h-3 w-3" /> Sessions
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink-900">{batch.sessionCount}</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit batch' : 'Create a batch'}
        description="Set the level, weekly schedule and trainer for this group."
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" form="batch-form" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create batch'}
            </button>
          </div>
        }
      >
        <form id="batch-form" onSubmit={submit} className="space-y-4">
          {formError ? <Alert tone="error" message={formError} onDismiss={() => setFormError(null)} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="batch-name">
                Batch name
              </label>
              <input
                id="batch-name"
                required
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="e.g. Beginners – Evening"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="batch-code">
                Batch code
              </label>
              <input
                id="batch-code"
                value={form.code}
                onChange={(event) => updateField('code', event.target.value)}
                placeholder="Auto-generated if empty"
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="batch-level">
                Level
              </label>
              <select
                id="batch-level"
                value={form.level}
                onChange={(event) => updateField('level', event.target.value as Level)}
                className="input"
              >
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="batch-trainer">
                Trainer
              </label>
              <select
                id="batch-trainer"
                value={form.trainerId}
                onChange={(event) => updateField('trainerId', event.target.value)}
                className="input"
              >
                <option value="">No trainer</option>
                {faculty
                  .filter((member) => member.isActive)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <span className="label">Class days</span>
            <div className="flex flex-wrap gap-1.5">
              {DAY_OPTIONS.map((day) => {
                const active = form.days.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="batch-start">
                Start time
              </label>
              <input
                id="batch-start"
                type="time"
                required
                value={form.startTime}
                onChange={(event) => updateField('startTime', event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="batch-end">
                End time
              </label>
              <input
                id="batch-end"
                type="time"
                required
                value={form.endTime}
                onChange={(event) => updateField('endTime', event.target.value)}
                className="input"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => updateField('isActive', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Batch is active and accepting students
          </label>
        </form>
      </Modal>
    </div>
  )
}
