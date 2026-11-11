import {
  GraduationCap,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import { ApiError, api } from '../lib/api'
import { formatDate, initials } from '../lib/format'
import type { Faculty } from '../lib/types'

interface FacultyForm {
  name: string
  email: string
  phone: string
  employeeId: string
  password: string
  isActive: boolean
}

function emptyForm(): FacultyForm {
  return { name: '', email: '', phone: '', employeeId: '', password: '', isActive: true }
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Faculty | null>(null)
  const [form, setForm] = useState<FacultyForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api<{ data: Faculty[] }>('/faculty')
      .then((response) => setFaculty(response.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load faculty'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const updateField = <K extends keyof FacultyForm>(key: K, value: FacultyForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (member: Faculty) => {
    setEditing(member)
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone ?? '',
      employeeId: member.employeeId,
      password: '',
      isActive: member.isActive,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      employeeId: form.employeeId.trim() || undefined,
      isActive: form.isActive,
      ...(form.password ? { password: form.password } : {}),
    }
    try {
      if (editing) {
        await api(`/faculty/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setNotice(`${payload.name} updated.`)
      } else {
        await api('/faculty', { method: 'POST', body: JSON.stringify(payload) })
        setNotice(`${payload.name} added. Default password: ${form.password || 'Coach@123'}.`)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save faculty')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Academy team"
        title="Faculty"
        description="Manage trainers, their login access and the batches they lead."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add faculty
          </button>
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <Alert tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      {loading ? (
        <div className="mt-4">
          <PageLoader label="Loading faculty…" />
        </div>
      ) : faculty.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={GraduationCap}
            title="No faculty yet"
            description="Add a trainer to assign batches and schedule classes."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="h-4 w-4" />
                Add faculty
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {faculty.map((member) => (
            <section key={member.id} className="card p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                  {initials(member.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-lg leading-tight text-ink-900">{member.name}</h2>
                    {member.isActive ? (
                      <span className="badge bg-emerald-50 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge bg-red-50 text-red-700">Inactive</span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {member.employeeId}
                  </p>
                </div>
                <button
                  onClick={() => openEdit(member)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-700"
                  title="Edit faculty"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <p className="flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {member.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {member.phone ?? 'No phone recorded'}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Batches</p>
                  <p className="mt-1 text-lg font-bold text-ink-900">{member.batchCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sessions</p>
                  <p className="mt-1 text-lg font-bold text-ink-900">{member.sessionCount}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>Joined {formatDate(member.joinedAt)}</span>
                <span className="font-semibold">
                  {member.hasLogin ? `Login: ${member.loginEmail}` : 'No login access'}
                </span>
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit faculty' : 'Add faculty'}
        description={
          editing
            ? 'Update contact details, login email or access status.'
            : 'A faculty login is created automatically so they can mark attendance.'
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" form="faculty-form" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add faculty'}
            </button>
          </div>
        }
      >
        <form id="faculty-form" onSubmit={submit} className="space-y-4">
          {formError ? <Alert tone="error" message={formError} onDismiss={() => setFormError(null)} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="faculty-name">
                Full name
              </label>
              <input
                id="faculty-name"
                required
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="e.g. Aravind Subramanian"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="faculty-employee">
                Employee ID
              </label>
              <input
                id="faculty-employee"
                value={form.employeeId}
                onChange={(event) => updateField('employeeId', event.target.value)}
                placeholder="Auto-generated if empty"
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="faculty-email">
                Login email
              </label>
              <input
                id="faculty-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="coach@chessbishop.in"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="faculty-phone">
                Phone
              </label>
              <input
                id="faculty-phone"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="+91 90000 00000"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="faculty-password">
              {editing ? 'Reset password' : 'Password'}
            </label>
            <input
              id="faculty-password"
              type="password"
              minLength={6}
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder={editing ? 'Leave blank to keep current password' : 'Defaults to Coach@123'}
              className="input"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              The faculty account can sign in immediately with this email and password.
            </p>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => updateField('isActive', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Login is active
          </label>
        </form>
      </Modal>
    </div>
  )
}
