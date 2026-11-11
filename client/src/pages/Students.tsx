import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  UserX,
  Users,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, api } from '../lib/api'
import { formatPercent, initials, todayISO } from '../lib/format'
import type {
  Batch,
  Level,
  StudentFormValues,
  StudentListItem,
  StudentStatus,
} from '../lib/types'
import { LEVEL_OPTIONS, levelLabel, riskBadgeClass } from '../lib/ui'

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

function emptyForm(): StudentFormValues {
  return {
    name: '',
    dob: '',
    guardianName: '',
    contact: '',
    email: '',
    level: 'BEGINNER',
    joiningDate: todayISO(),
    status: 'ACTIVE',
    batchId: '',
  }
}

function toForm(student: StudentListItem): StudentFormValues {
  return {
    name: student.name,
    dob: student.dob ? student.dob.slice(0, 10) : '',
    guardianName: student.guardianName ?? '',
    contact: student.contact ?? '',
    email: student.email ?? '',
    level: student.level,
    joiningDate: student.joiningDate ? student.joiningDate.slice(0, 10) : todayISO(),
    status: student.status,
    batchId: student.batches[0]?.id ?? '',
  }
}

export default function Students() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [batches, setBatches] = useState<Batch[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [batchId, setBatchId] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StudentListItem | null>(null)
  const [form, setForm] = useState<StudentFormValues>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<StudentListItem | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  useEffect(() => {
    api<{ data: Batch[] }>('/batches')
      .then((response) => setBatches(response.data))
      .catch(() => setBatches([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (query) params.set('search', query)
    if (batchId) params.set('batchId', batchId)
    if (status) params.set('status', status)

    api<{ data: StudentListItem[]; pagination: Pagination }>(`/students?${params.toString()}`)
      .then((response) => {
        if (!active) return
        setStudents(response.data)
        setPagination(response.pagination)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof ApiError ? err.message : 'Unable to load students')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, batchId, status, page, reloadKey])

  const reload = () => setReloadKey((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (student: StudentListItem) => {
    setEditing(student)
    setForm(toForm(student))
    setFormError(null)
    setModalOpen(true)
  }

  const updateField = <K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submitForm = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    const payload = {
      name: form.name.trim(),
      dob: form.dob || null,
      guardianName: form.guardianName.trim(),
      contact: form.contact.trim(),
      email: form.email.trim(),
      level: form.level,
      joiningDate: form.joiningDate || null,
      status: form.status,
      batchId: form.batchId || null,
    }
    try {
      if (editing) {
        await api(`/students/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setNotice(`${payload.name} updated successfully.`)
      } else {
        await api('/students', { method: 'POST', body: JSON.stringify(payload) })
        setNotice(`${payload.name} added to the academy.`)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save student')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async () => {
    if (!confirmTarget) return
    setDeactivating(true)
    try {
      await api(`/students/${confirmTarget.id}`, { method: 'DELETE' })
      setNotice(`${confirmTarget.name} marked inactive and removed from active batch rosters.`)
      setConfirmTarget(null)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to deactivate student')
    } finally {
      setDeactivating(false)
    }
  }

  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total)

  return (
    <div>
      <PageHeader
        eyebrow="Student directory"
        title="Students"
        description={
          isAdmin
            ? 'Manage enrolment, batches and levels, and keep an eye on attendance risk.'
            : 'Students in your assigned batches, with live attendance health.'
        }
        actions={
          isAdmin ? (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              Add student
            </button>
          ) : undefined
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <Alert tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="card mt-4 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, code, guardian or phone…"
              className="input pl-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:w-auto lg:grid-cols-2">
            <select
              value={batchId}
              onChange={(event) => {
                setBatchId(event.target.value)
                setPage(1)
              }}
              className="input lg:w-48"
            >
              <option value="">All batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="input lg:w-40"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="">All statuses</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-slate-500">
          {loading ? 'Loading…' : `${pagination.total} ${pagination.total === 1 ? 'student' : 'students'}`}
        </p>
        <button onClick={reload} className="text-[11px] font-bold uppercase tracking-wide text-brand-600 hover:text-brand-700">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-2">
          <PageLoader label="Loading students…" />
        </div>
      ) : students.length === 0 ? (
        <div className="mt-2">
          <EmptyState
            icon={Users}
            title="No students found"
            description="Try changing the filters or add a new student to the academy."
            action={
              isAdmin ? (
                <button onClick={openCreate} className="btn-primary">
                  <Plus className="h-4 w-4" />
                  Add student
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card mt-2 overflow-hidden">
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 md:grid md:grid-cols-[minmax(0,2fr)_1.2fr_0.8fr_1fr_auto] md:items-center md:gap-3">
            <span>Student</span>
            <span>Batch</span>
            <span>Level</span>
            <span>Attendance</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {students.map((student) => (
              <li key={student.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,2fr)_1.2fr_0.8fr_1fr_auto] md:items-center md:gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                      {initials(student.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/students/${student.id}`}
                          className="truncate text-sm font-semibold text-ink-900 hover:text-brand-700"
                        >
                          {student.name}
                        </Link>
                        {student.status === 'INACTIVE' ? (
                          <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {student.studentCode}
                        {student.guardianName ? ` · ${student.guardianName}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                        {student.batches.length > 0 ? (
                          student.batches.map((batch) => (
                            <span key={batch.id} className="badge bg-slate-100 text-slate-600">
                              {batch.code}
                            </span>
                          ))
                        ) : (
                          <span className="badge bg-slate-100 text-slate-500">No batch</span>
                        )}
                        <span className={`badge ${riskBadgeClass(student.risk)}`}>{student.risk}</span>
                        <span className="text-[11px] font-bold text-slate-600">
                          {formatPercent(student.attendance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden flex-wrap gap-1.5 md:flex">
                    {student.batches.length > 0 ? (
                      student.batches.map((batch) => (
                        <span key={batch.id} className="badge bg-slate-100 text-slate-600">
                          {batch.code}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">Not assigned</span>
                    )}
                  </div>

                  <div className="hidden md:block">
                    <span className="text-xs font-semibold text-slate-600">{levelLabel(student.level)}</span>
                  </div>

                  <div className="hidden items-center gap-2 md:flex">
                    <span className="text-sm font-bold text-ink-900">{formatPercent(student.attendance)}</span>
                    <span className={`badge ${riskBadgeClass(student.risk)}`}>{student.risk}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/students/${student.id}`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-700"
                      title="View profile"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => openEdit(student)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-700"
                          title="Edit student"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {student.status === 'ACTIVE' ? (
                          <button
                            onClick={() => setConfirmTarget(student)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            title="Deactivate student"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{start}</span>–
              <span className="font-semibold text-slate-700">{end}</span> of{' '}
              <span className="font-semibold text-slate-700">{pagination.total}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={pagination.page <= 1}
                className="btn-secondary !py-1.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Page {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-secondary !py-1.5 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit student' : 'Add a new student'}
        description={
          editing
            ? 'Update enrolment details or move the student to a different batch.'
            : 'Create a student record and assign them to a batch.'
        }
        wide
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" form="student-form" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add student'}
            </button>
          </div>
        }
      >
        <form id="student-form" onSubmit={submitForm} className="space-y-4">
          {formError ? <Alert tone="error" message={formError} onDismiss={() => setFormError(null)} /> : null}

          <div>
            <label className="label" htmlFor="student-name">
              Full name
            </label>
            <input
              id="student-name"
              required
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="e.g. Ananya Krishnan"
              className="input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="student-guardian">
                Parent / guardian
              </label>
              <input
                id="student-guardian"
                value={form.guardianName}
                onChange={(event) => updateField('guardianName', event.target.value)}
                placeholder="Guardian name"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="student-contact">
                Contact number
              </label>
              <input
                id="student-contact"
                value={form.contact}
                onChange={(event) => updateField('contact', event.target.value)}
                placeholder="+91 90000 00000"
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="student-email">
                Email
              </label>
              <input
                id="student-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="optional@email.com"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="student-dob">
                Date of birth
              </label>
              <input
                id="student-dob"
                type="date"
                value={form.dob}
                onChange={(event) => updateField('dob', event.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="student-level">
                Level
              </label>
              <select
                id="student-level"
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
              <label className="label" htmlFor="student-status">
                Status
              </label>
              <select
                id="student-status"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as StudentStatus)}
                className="input"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="student-joining">
                Joining date
              </label>
              <input
                id="student-joining"
                type="date"
                value={form.joiningDate}
                onChange={(event) => updateField('joiningDate', event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="student-batch">
                Batch
              </label>
              <select
                id="student-batch"
                value={form.batchId}
                onChange={(event) => updateField('batchId', event.target.value)}
                className="input"
              >
                <option value="">No batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} ({batch.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Changing the batch ends the student's previous active batch assignment. Attendance history is preserved.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        title="Deactivate student"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setConfirmTarget(null)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={deactivate} disabled={deactivating} className="btn-danger">
              {deactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
              {deactivating ? 'Deactivating…' : 'Deactivate'}
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-ink-900">{confirmTarget?.name}</span> will be marked inactive and removed
          from active batch rosters. Their attendance history is kept for reporting.
        </p>
      </Modal>
    </div>
  )
}
