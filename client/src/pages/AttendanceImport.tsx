import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RotateCcw,
  UploadCloud,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import PageHeader from '../components/PageHeader'
import { ApiError, api, downloadFile, uploadFile } from '../lib/api'
import { addDaysISO, formatDate, formatTime, todayISO } from '../lib/format'
import type {
  AttendanceImportAction,
  AttendanceImportIssue,
  AttendanceImportPreview,
  AttendanceImportResult,
  Batch,
} from '../lib/types'

const MAX_FILE_BYTES = 10 * 1024 * 1024

const actionStyles: Record<AttendanceImportAction, string> = {
  create: 'bg-emerald-50 text-emerald-700',
  reuse: 'bg-sky-50 text-sky-700',
  skip: 'bg-slate-100 text-slate-600',
  blocked: 'bg-red-50 text-red-700',
}

const actionLabels: Record<AttendanceImportAction, string> = {
  create: 'Create session',
  reuse: 'Use session',
  skip: 'Already complete',
  blocked: 'Blocked',
}

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function issueLocation(issue: AttendanceImportIssue): string {
  const parts: string[] = []
  if (issue.rowNumber) parts.push(`Row ${issue.rowNumber}`)
  if (issue.column) parts.push(issue.column)
  if (issue.studentCode) parts.push(issue.studentCode)
  if (issue.batchCode) parts.push(issue.batchCode)
  return parts.join(' · ') || 'Workbook'
}

function SummaryTile({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string | number
  detail?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const tones = {
    default: 'text-ink-900',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-1 font-display text-2xl leading-none ${tones[tone]}`}>{value}</p>
      {detail ? <p className="mt-1 text-[11px] text-slate-500">{detail}</p> : null}
    </div>
  )
}

export default function AttendanceImport() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [from, setFrom] = useState(addDaysISO(-29))
  const [to, setTo] = useState(todayISO())
  const [batchId, setBatchId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AttendanceImportPreview | null>(null)
  const [result, setResult] = useState<AttendanceImportResult | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [commitLoading, setCommitLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ data: Batch[] }>('/batches')
      .then((response) => setBatches(response.data))
      .catch(() => setBatches([]))
  }, [])

  const chooseFile = (next: File | null) => {
    setError(null)
    setPreview(null)
    setResult(null)
    if (!next) {
      setFile(null)
      return
    }
    if (!next.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null)
      setError('Choose an .xlsx workbook. Older .xls files are not supported.')
      return
    }
    if (next.size > MAX_FILE_BYTES) {
      setFile(null)
      setError('The workbook is larger than 10 MB. Split it into smaller files.')
      return
    }
    setFile(next)
  }

  const downloadTemplate = async () => {
    setTemplateLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      if (batchId) params.set('batchId', batchId)
      await downloadFile(
        `/attendance-import/template.xlsx?${params.toString()}`,
        `chessbishop-attendance-template-${from}-to-${to}.xlsx`,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to download the template')
    } finally {
      setTemplateLoading(false)
    }
  }

  const validateFile = async () => {
    if (!file) return
    setPreviewLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await uploadFile<AttendanceImportPreview>('/attendance-import/preview', file)
      setPreview(response)
    } catch (err) {
      setPreview(null)
      setError(err instanceof ApiError ? err.message : 'Unable to validate this workbook')
    } finally {
      setPreviewLoading(false)
    }
  }

  const commitFile = async () => {
    if (!file || !preview) return
    setCommitLoading(true)
    setError(null)
    try {
      const response = await uploadFile<AttendanceImportResult>('/attendance-import/commit', file)
      setResult(response)
      setPreview(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to import this workbook')
    } finally {
      setCommitLoading(false)
    }
  }

  const reset = () => {
    chooseFile(null)
    if (inputRef.current) inputRef.current.value = ''
    setError(null)
  }

  const blocked = Boolean(preview && preview.summary.errors > 0)
  const nothingToImport = Boolean(preview && preview.summary.newRecords === 0 && !blocked)

  return (
    <div>
      <PageHeader
        eyebrow="Admin backfill"
        title="Import previous attendance"
        description="Download a dated matrix, fill in past classes and upload it back. Existing attendance is never overwritten."
        actions={
          <Link to="/attendance" className="btn-secondary">
            Back to attendance
          </Link>
        }
      />

      {error ? <Alert tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      {result ? (
        <div className="mt-4 space-y-6">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50/80 via-white to-white px-5 py-6 sm:px-6">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-600 text-white">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-display text-2xl text-ink-900">
                {result.imported > 0 ? 'Import complete' : 'Nothing new to import'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {result.imported > 0
                  ? 'New attendance records are now part of the academy history.'
                  : 'Every mark in this workbook was already recorded. Existing attendance was left untouched.'}
              </p>
            </div>

            <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
              <SummaryTile label="Imported" value={result.imported} detail="new attendance records" tone="success" />
              <SummaryTile label="Skipped" value={result.skipped} detail="already recorded" />
              <SummaryTile label="Sessions created" value={result.createdSessions} />
              <SummaryTile
                label="Sessions reused"
                value={result.reusedSessions}
                detail={`${result.skippedSessions} already complete`}
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:px-6">
              <Link to="/attendance" className="btn-primary">
                Open attendance
              </Link>
              <Link to="/analytics" className="btn-secondary">
                View analytics
              </Link>
              <button onClick={reset} className="btn-ghost sm:ml-auto">
                <RotateCcw className="h-4 w-4" />
                Import another file
              </button>
            </div>
          </section>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50/70 via-white to-white px-5 py-5 sm:px-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-xl text-ink-900">1. Build the matrix</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pick the historical period and batch, then download a workbook with student rows and one
                  column per class date.
                </p>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="import-from">
                      From
                    </label>
                    <input
                      id="import-from"
                      type="date"
                      value={from}
                      max={todayISO()}
                      onChange={(event) => setFrom(event.target.value || addDaysISO(-29))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="import-to">
                      To
                    </label>
                    <input
                      id="import-to"
                      type="date"
                      value={to}
                      max={todayISO()}
                      onChange={(event) => setTo(event.target.value || todayISO())}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="import-batch">
                    Batch
                  </label>
                  <select
                    id="import-batch"
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
                <p className="text-[11px] leading-relaxed text-slate-500">
                  The template includes current and historical student assignments that overlap the selected
                  period. Leave a status cell blank when there was no class or you do not want to import it.
                </p>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
                <button
                  onClick={downloadTemplate}
                  disabled={templateLoading}
                  className="btn-secondary w-full"
                >
                  {templateLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {templateLoading ? 'Building template…' : 'Download Excel template'}
                </button>
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-white px-5 py-5 sm:px-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-900 text-white">
                  <FileUp className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-xl text-ink-900">2. Upload and validate</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Preview every row before anything is written. Errors block the whole import, so nothing is
                  saved partially.
                </p>
              </div>

              <div className="px-5 py-5 sm:px-6">
                <input
                  ref={inputRef}
                  id="attendance-import-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="attendance-import-file"
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    chooseFile(event.dataTransfer.files?.[0] ?? null)
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-9 text-center transition ${
                    dragging
                      ? 'border-brand-500 bg-brand-50/60'
                      : file
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30'
                  }`}
                >
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full ${
                      file ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-brand-600 ring-1 ring-slate-200'
                    }`}
                  >
                    {file ? <FileSpreadsheet className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-ink-900">
                    {file ? file.name : 'Drop your completed .xlsx here'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {file
                      ? `${fileSize(file.size)} · click or drop again to replace`
                      : 'or click to choose a file · up to 10 MB'}
                  </p>
                </label>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
                  Existing attendance is always skipped. Re-importing the same workbook will never change a
                  saved status or remark.
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
                <button
                  onClick={validateFile}
                  disabled={!file || previewLoading}
                  className="btn-primary w-full"
                >
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {previewLoading ? 'Checking workbook…' : preview ? 'Re-validate workbook' : 'Validate & preview'}
                </button>
              </div>
            </section>
          </div>

          {preview ? (
            <div className="mt-6 space-y-6">
              <section className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl text-ink-900">3. Review the preview</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {blocked
                        ? 'Fix the errors below and validate the workbook again.'
                        : nothingToImport
                          ? 'Everything here is already recorded. There is nothing new to import.'
                          : 'Nothing has been written yet. Confirm below to add the new records.'}
                    </p>
                  </div>
                  <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">
                    {preview.summary.totalRows} {preview.summary.totalRows === 1 ? 'row' : 'rows'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                  <SummaryTile
                    label="Valid marks"
                    value={preview.summary.validMarks}
                    detail={`${preview.summary.totalMarks} filled cells`}
                  />
                  <SummaryTile
                    label="New records"
                    value={preview.summary.newRecords}
                    tone="success"
                    detail="will be added"
                  />
                  <SummaryTile
                    label="Skipped"
                    value={preview.summary.skippedRecords}
                    detail="already recorded"
                  />
                  <SummaryTile
                    label="Sessions to create"
                    value={preview.summary.sessionsToCreate}
                    detail={`${preview.summary.sessionsToReuse} reused`}
                  />
                  <SummaryTile
                    label="Errors"
                    value={preview.summary.errors}
                    tone={preview.summary.errors > 0 ? 'danger' : 'default'}
                    detail={`${preview.summary.warnings} warnings`}
                  />
                </div>
              </section>

              {preview.summary.errors > 0 ? (
                <Alert
                  tone="error"
                  message={`${preview.summary.errors} ${
                    preview.summary.errors === 1 ? 'error needs' : 'errors need'
                  } attention before this workbook can be imported.`}
                />
              ) : preview.summary.warnings > 0 ? (
                <Alert
                  tone="info"
                  message={`${preview.summary.warnings} ${
                    preview.summary.warnings === 1 ? 'warning was' : 'warnings were'
                  } found. Warnings do not block the import.`}
                />
              ) : null}

              {preview.issues.length > 0 ? (
                <section className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div>
                      <h2 className="font-display text-lg text-ink-900">Validation issues</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Row numbers match the Attendance sheet.
                      </p>
                    </div>
                    <span className="badge bg-slate-100 text-slate-600">{preview.issues.length}</span>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="data-table">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th>Type</th>
                          <th>Location</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.issues.map((issue, index) => (
                          <tr key={`${issue.rowNumber ?? 0}-${issue.column ?? ''}-${index}`}>
                            <td>
                              <span
                                className={`badge ${
                                  issue.severity === 'error'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {issue.severity === 'error' ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : null}
                                {issue.severity}
                              </span>
                            </td>
                            <td className="whitespace-nowrap text-xs font-semibold text-slate-600">
                              {issueLocation(issue)}
                            </td>
                            <td className="min-w-[280px] text-xs text-slate-600">{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {preview.sessions.length > 0 ? (
                <section className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div>
                      <h2 className="font-display text-lg text-ink-900">Class sessions</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Missing sessions are created as completed classes.
                      </p>
                    </div>
                    <span className="badge bg-slate-100 text-slate-600">{preview.sessions.length}</span>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="data-table">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th>Date</th>
                          <th>Batch</th>
                          <th>Topic</th>
                          <th>Action</th>
                          <th>New</th>
                          <th>Skipped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sessions.map((session) => (
                          <tr key={`${session.date}-${session.batchCode}-${session.startTime}`}>
                            <td className="whitespace-nowrap">
                              <p className="text-xs font-semibold text-ink-900">
                                {formatDate(session.date, {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {formatTime(session.startTime)} – {formatTime(session.endTime)}
                              </p>
                            </td>
                            <td>
                              <p className="text-xs font-semibold text-ink-900">{session.batchCode}</p>
                              <p className="text-[11px] text-slate-500">{session.batchName}</p>
                            </td>
                            <td className="text-xs text-slate-600">
                              {session.topicName ?? <span className="text-slate-400">No topic</span>}
                            </td>
                            <td>
                              <span className={`badge ${actionStyles[session.action]}`}>
                                {actionLabels[session.action]}
                              </span>
                            </td>
                            <td className="text-xs font-semibold text-emerald-600">{session.newRecords}</td>
                            <td className="text-xs font-semibold text-slate-500">
                              {session.skippedRecords}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="card p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="font-display text-lg text-ink-900">4. Confirm import</h2>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                      {blocked
                        ? 'Import is disabled until every validation error is fixed.'
                        : nothingToImport
                          ? 'No new records were found, so there is nothing to write.'
                          : `${preview.summary.newRecords} new ${
                              preview.summary.newRecords === 1 ? 'record' : 'records'
                            } will be added across ${Math.max(
                              1,
                              preview.summary.sessionsToCreate + preview.summary.sessionsToReuse,
                            )} ${
                              preview.summary.sessionsToCreate + preview.summary.sessionsToReuse === 1
                                ? 'class'
                                : 'classes'
                            }. Existing attendance is skipped and never overwritten.`}
                    </p>
                  </div>
                  <button
                    onClick={commitFile}
                    disabled={blocked || nothingToImport || commitLoading}
                    className="btn-primary shrink-0"
                  >
                    {commitLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {commitLoading
                      ? 'Importing…'
                      : preview.summary.newRecords > 0
                        ? `Import ${preview.summary.newRecords} ${
                            preview.summary.newRecords === 1 ? 'record' : 'records'
                          }`
                        : 'Nothing to import'}
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
