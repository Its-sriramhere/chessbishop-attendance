import { BookOpen, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { EmptyState, PageLoader } from '../components/PageState'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, api } from '../lib/api'
import type { Level, Topic } from '../lib/types'
import { LEVEL_OPTIONS, levelLabel } from '../lib/ui'

interface TopicForm {
  name: string
  code: string
  category: string
  difficulty: Level
  description: string
  objectives: string
  estimatedMinutes: string
  parentId: string
}

function emptyForm(): TopicForm {
  return {
    name: '',
    code: '',
    category: '',
    difficulty: 'BEGINNER',
    description: '',
    objectives: '',
    estimatedMinutes: '',
    parentId: '',
  }
}

export default function Topics() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [form, setForm] = useState<TopicForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    api<{ data: Topic[] }>('/topics')
      .then((response) => setTopics(response.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load topics'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(topics.map((topic) => topic.category))).sort(),
    [topics],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return topics.filter((topic) => {
      if (category && topic.category !== category) return false
      if (!term) return true
      return (
        topic.name.toLowerCase().includes(term) ||
        topic.code.toLowerCase().includes(term) ||
        topic.category.toLowerCase().includes(term)
      )
    })
  }, [topics, search, category])

  const updateField = <K extends keyof TopicForm>(key: K, value: TopicForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (topic: Topic) => {
    setEditing(topic)
    setForm({
      name: topic.name,
      code: topic.code,
      category: topic.category,
      difficulty: topic.difficulty,
      description: topic.description ?? '',
      objectives: topic.objectives ?? '',
      estimatedMinutes: topic.estimatedMinutes ? String(topic.estimatedMinutes) : '',
      parentId: topic.parent?.id ?? '',
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
      code: form.code.trim() || undefined,
      category: form.category.trim(),
      difficulty: form.difficulty,
      description: form.description.trim(),
      objectives: form.objectives.trim(),
      estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
      parentId: form.parentId || null,
    }
    try {
      if (editing) {
        await api(`/topics/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setNotice(`${payload.name} updated.`)
      } else {
        await api('/topics', { method: 'POST', body: JSON.stringify(payload) })
        setNotice(`${payload.name} added to the curriculum.`)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save the topic')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/topics/${deleteTarget.id}`, { method: 'DELETE' })
      setNotice(`${deleteTarget.name} deleted.`)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete the topic')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const parentOptions = topics.filter((topic) => !topic.parent && topic.id !== editing?.id)

  return (
    <div>
      <PageHeader
        eyebrow="Curriculum"
        title="Chess Topics"
        description={
          isAdmin
            ? 'Maintain the topic library used to plan classes and analyse topic-wise attendance.'
            : 'The topic library used to plan classes and review topic coverage.'
        }
        actions={
          isAdmin ? (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              New topic
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
              placeholder="Search topics or categories…"
              className="input pl-10"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="input lg:w-60"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="mt-4">
          <PageLoader label="Loading curriculum…" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={BookOpen}
            title="No topics found"
            description="Try another search or add a new topic to the curriculum."
            action={
              isAdmin ? (
                <button onClick={openCreate} className="btn-primary">
                  <Plus className="h-4 w-4" />
                  Add topic
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 md:grid md:grid-cols-[minmax(0,2fr)_1fr_0.8fr_0.7fr_0.7fr_auto] md:items-center md:gap-3">
            <span>Topic</span>
            <span>Category</span>
            <span>Level</span>
            <span>Sessions</span>
            <span>Subtopics</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {filtered.map((topic) => (
              <li key={topic.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,2fr)_1fr_0.8fr_0.7fr_0.7fr_auto] md:items-center md:gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-600">{topic.code}</span>
                      <p className="truncate text-sm font-semibold text-ink-900">{topic.name}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {topic.parent ? `Subtopic of ${topic.parent.name}` : topic.description ?? 'No description'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                      <span className="badge bg-brand-50 text-brand-700">{topic.category}</span>
                      <span className="badge bg-slate-100 text-slate-600">{levelLabel(topic.difficulty)}</span>
                      <span className="badge bg-slate-100 text-slate-600">{topic.sessionCount} sessions</span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <span className="badge bg-brand-50 text-brand-700">{topic.category}</span>
                  </div>
                  <div className="hidden md:block text-xs font-semibold text-slate-600">
                    {levelLabel(topic.difficulty)}
                  </div>
                  <div className="hidden md:block text-sm font-bold text-ink-900">{topic.sessionCount}</div>
                  <div className="hidden md:block text-sm text-slate-600">{topic.childCount}</div>
                  <div className="flex items-center gap-1.5">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => openEdit(topic)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-700"
                          title="Edit topic"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(topic)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          title="Delete topic"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400">View only</span>
                    )}
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
        title={editing ? 'Edit topic' : 'Add a topic'}
        description="Topics connect class sessions to attendance analysis and curriculum coverage."
        wide
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" form="topic-form" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add topic'}
            </button>
          </div>
        }
      >
        <form id="topic-form" onSubmit={submit} className="space-y-4">
          {formError ? <Alert tone="error" message={formError} onDismiss={() => setFormError(null)} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="topic-name">
                Topic name
              </label>
              <input
                id="topic-name"
                required
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="e.g. Pin tactics"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="topic-code">
                Topic code
              </label>
              <input
                id="topic-code"
                value={form.code}
                onChange={(event) => updateField('code', event.target.value)}
                placeholder="Auto-generated if empty"
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="topic-category">
                Category
              </label>
              <input
                id="topic-category"
                required
                list="topic-categories"
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                placeholder="e.g. Tactics"
                className="input"
              />
              <datalist id="topic-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label" htmlFor="topic-level">
                Difficulty
              </label>
              <select
                id="topic-level"
                value={form.difficulty}
                onChange={(event) => updateField('difficulty', event.target.value as Level)}
                className="input"
              >
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="topic-parent">
                Parent topic
              </label>
              <select
                id="topic-parent"
                value={form.parentId}
                onChange={(event) => updateField('parentId', event.target.value)}
                className="input"
              >
                <option value="">None (top-level topic)</option>
                {parentOptions.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="topic-minutes">
                Estimated minutes
              </label>
              <input
                id="topic-minutes"
                type="number"
                min={5}
                max={600}
                value={form.estimatedMinutes}
                onChange={(event) => updateField('estimatedMinutes', event.target.value)}
                placeholder="e.g. 45"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="topic-description">
              Description
            </label>
            <textarea
              id="topic-description"
              rows={2}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="What this topic covers"
              className="input resize-none"
            />
          </div>

          <div>
            <label className="label" htmlFor="topic-objectives">
              Learning objectives
            </label>
            <textarea
              id="topic-objectives"
              rows={2}
              value={form.objectives}
              onChange={(event) => updateField('objectives', event.target.value)}
              placeholder="What students should be able to do after this topic"
              className="input resize-none"
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete topic"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={deleting} className="btn-danger">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? 'Deleting…' : 'Delete topic'}
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Delete <span className="font-semibold text-ink-900">{deleteTarget?.name}</span>? Topics used by class
          sessions or with subtopics cannot be deleted.
        </p>
      </Modal>
    </div>
  )
}
