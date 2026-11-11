import type { AttendanceStatus, SessionStatus } from '@prisma/client'
import ExcelJS from 'exceljs'
import { prisma } from '../lib/prisma'
import { endOfDay, startOfDay } from '../utils/date'
import { HttpError } from '../utils/http-error'

const ATTENDANCE_SHEET = 'Attendance'
const PLAN_SHEET = 'Session Plan'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_MATRIX_ROWS = 2000
const MAX_DATE_COLUMNS = 366
const MAX_MARKS = 5000
const MAX_TEMPLATE_DAYS = 366
const HEADER_FILL = 'FF0A1029'
const HEADER_FONT = 'FFFFFFFF'
const SECTION_FILL = 'FFEDE9FE'

const STATUS_ALIASES: Record<string, AttendanceStatus> = {
  PRESENT: 'PRESENT',
  P: 'PRESENT',
  '✓': 'PRESENT',
  ABSENT: 'ABSENT',
  A: 'ABSENT',
  LATE: 'LATE',
  L: 'LATE',
  EXCUSED: 'EXCUSED',
  E: 'EXCUSED',
  EXCUSE: 'EXCUSED',
}

const MONTH_NAMES: Record<string, number> = {
  JAN: 1,
  JANUARY: 1,
  FEB: 2,
  FEBRUARY: 2,
  MAR: 3,
  MARCH: 3,
  APR: 4,
  APRIL: 4,
  MAY: 5,
  JUN: 6,
  JUNE: 6,
  JUL: 7,
  JULY: 7,
  AUG: 8,
  AUGUST: 8,
  SEP: 9,
  SEPT: 9,
  SEPTEMBER: 9,
  OCT: 10,
  OCTOBER: 10,
  NOV: 11,
  NOVEMBER: 11,
  DEC: 12,
  DECEMBER: 12,
}

export interface ImportIssue {
  severity: 'error' | 'warning'
  rowNumber?: number
  column?: string
  studentCode?: string
  batchCode?: string
  message: string
}

export interface ImportSessionPreview {
  date: string
  batchCode: string
  batchName: string
  topicCode: string | null
  topicName: string | null
  trainerName: string | null
  startTime: string
  endTime: string
  action: 'create' | 'reuse' | 'skip' | 'blocked'
  newRecords: number
  skippedRecords: number
}

export interface ImportSummary {
  totalRows: number
  totalMarks: number
  validMarks: number
  newRecords: number
  skippedRecords: number
  sessionsToCreate: number
  sessionsToReuse: number
  sessionsSkipped: number
  errors: number
  warnings: number
}

export interface ImportPreview {
  summary: ImportSummary
  sessions: ImportSessionPreview[]
  issues: ImportIssue[]
}

export interface ImportResult {
  imported: number
  skipped: number
  createdSessions: number
  reusedSessions: number
  skippedSessions: number
  totalMarks: number
}

interface MatrixMark {
  columnNumber: number
  columnLabel: string
  date: Date
  dateISO: string
  rawStatus: string
  status: AttendanceStatus | null
}

interface MatrixRow {
  rowNumber: number
  studentCode: string
  studentName: string
  batchCode: string
  marks: MatrixMark[]
}

interface PlanRow {
  rowNumber: number
  date: Date
  dateISO: string
  batchCode: string
  topicCode: string
  startTime: string | null
  endTime: string | null
  description: string | null
}

interface ParsedWorkbook {
  rows: MatrixRow[]
  plans: PlanRow[]
  issues: ImportIssue[]
  totalMarks: number
  hasDateColumns: boolean
}

interface GroupMark {
  studentId: string
  studentCode: string
  studentName: string
  status: AttendanceStatus
  rowNumber: number
  columnLabel: string
}

interface AnalysedGroup {
  batchId: string
  batchCode: string
  batchName: string
  date: Date
  dateISO: string
  startTime: string
  endTime: string
  topicId: string | null
  topicCode: string | null
  topicName: string | null
  trainerId: string | null
  trainerName: string | null
  planRowNumber: number | null
  existingSessionId: string | null
  existingTopicId: string | null
  existingStatus: SessionStatus | null
  action: 'create' | 'reuse' | 'skip' | 'blocked'
  newRecords: GroupMark[]
  skippedRecords: number
}

interface Analysis extends ImportPreview {
  groups: AnalysedGroup[]
  errors: number
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function makeDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function dateFromParts(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return makeDate(year, month, day)
}

function dateFromSerial(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
  const result = makeDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  return result
}

function dateFromRaw(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    const utcMidnight =
      raw.getUTCHours() === 0 &&
      raw.getUTCMinutes() === 0 &&
      raw.getUTCSeconds() === 0 &&
      raw.getUTCMilliseconds() === 0
    return utcMidnight
      ? makeDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate())
      : makeDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate())
  }

  if (typeof raw === 'number') return dateFromSerial(raw)

  const text = String(raw).trim()
  if (!text) return null

  const cleaned = text.replace(/\([^)]*\)/g, ' ').trim()

  const iso = cleaned.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    return dateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const dayFirst = cleaned.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (dayFirst) {
    return dateFromParts(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]))
  }

  const named = cleaned.match(/(\d{1,2})[ -]([A-Za-z]{3,})[ -](\d{4})/)
  if (named) {
    const month = MONTH_NAMES[named[2].toUpperCase()]
    if (month) return dateFromParts(Number(named[3]), month, Number(named[1]))
  }

  const withMonthFirst = cleaned.match(/([A-Za-z]{3,})[ -](\d{1,2}),?[ -](\d{4})/)
  if (withMonthFirst) {
    const month = MONTH_NAMES[withMonthFirst[1].toUpperCase()]
    if (month) return dateFromParts(Number(withMonthFirst[3]), month, Number(withMonthFirst[2]))
  }

  return null
}

function timeFromRaw(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    const hours = raw.getUTCHours()
    const minutes = raw.getUTCMinutes()
    if (hours === 0 && minutes === 0 && raw.getUTCDate() === 30 && raw.getUTCMonth() === 11) {
      return '00:00'
    }
    return `${pad(hours)}:${pad(minutes)}`
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    const fraction = raw - Math.floor(raw)
    const totalMinutes = Math.round((fraction > 0 ? fraction : raw) * 1440) % 1440
    return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`
  }

  const text = String(raw).trim()
  if (!text) return null

  const twentyFour = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (twentyFour) {
    return `${pad(Number(twentyFour[1]))}:${twentyFour[2]}`
  }

  const twelve = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (twelve) {
    let hour = Number(twelve[1])
    const minute = Number(twelve[2] ?? '0')
    const suffix = twelve[3].toUpperCase()
    if (hour < 1 || hour > 12 || minute > 59) return null
    if (suffix === 'PM' && hour !== 12) hour += 12
    if (suffix === 'AM' && hour === 12) hour = 0
    return `${pad(hour)}:${pad(minute)}`
  }

  return null
}

function statusFromRaw(raw: string): AttendanceStatus | null {
  return STATUS_ALIASES[raw.trim().toUpperCase()] ?? null
}

function rawCell(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'object') {
    const candidate = value as {
      result?: unknown
      richText?: { text: string }[]
      text?: string
    }
    if (candidate.result !== undefined && candidate.result !== null) return candidate.result
    if (candidate.richText) return candidate.richText.map((part) => part.text).join('')
    if (typeof candidate.text === 'string') return candidate.text
  }
  return null
}

function cellText(cell: ExcelJS.Cell): string {
  const raw = rawCell(cell.value)
  if (raw === null || raw === undefined) return ''
  if (raw instanceof Date) return formatISODate(raw)
  return String(raw).trim()
}

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | null {
  const target = name.trim().toLowerCase()
  return workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === target) ?? null
}

function attendanceSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const named = findSheet(workbook, ATTENDANCE_SHEET)
  if (named) return named

  const support = new Set(['sessionplan', 'instructions', 'batches', 'topics', 'reference'])
  const candidates = workbook.worksheets.filter((sheet) => !support.has(normaliseHeader(sheet.name)))
  if (candidates.length === 1) return candidates[0]

  throw new HttpError(400, `The workbook must contain a sheet named "${ATTENDANCE_SHEET}".`)
}

function headerRowNumber(sheet: ExcelJS.Worksheet, required: string[]): number | null {
  for (let rowNumber = 1; rowNumber <= Math.min(10, sheet.rowCount); rowNumber += 1) {
    const found = new Set<string>()
    const row = sheet.getRow(rowNumber)
    for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
      found.add(normaliseHeader(cellText(row.getCell(columnNumber))))
    }
    if (required.every((key) => found.has(key))) return rowNumber
  }
  return null
}

function parseAttendanceSheet(sheet: ExcelJS.Worksheet): ParsedWorkbook {
  const issues: ImportIssue[] = []
  const headerNumber = headerRowNumber(sheet, ['studentcode', 'batchcode'])
  if (!headerNumber) {
    throw new HttpError(
      400,
      'Attendance sheet must include "Student Code" and "Batch Code" columns.',
    )
  }

  const header = sheet.getRow(headerNumber)
  let studentCodeColumn = 0
  let studentNameColumn = 0
  let batchCodeColumn = 0
  const dateColumns: {
    columnNumber: number
    label: string
    date: Date
    dateISO: string
  }[] = []
  const seenDates = new Set<string>()

  for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
    const label = cellText(header.getCell(columnNumber))
    if (!label) continue
    const key = normaliseHeader(label)

    if (key === 'studentcode' || key === 'studentid') {
      studentCodeColumn = columnNumber
      continue
    }
    if (key === 'studentname' || key === 'name') {
      studentNameColumn = columnNumber
      continue
    }
    if (key === 'batchcode' || key === 'batch' || key === 'batchid') {
      batchCodeColumn = columnNumber
      continue
    }

    const date = dateFromRaw(rawCell(header.getCell(columnNumber).value))
    if (!date) {
      issues.push({
        severity: 'error',
        rowNumber: headerNumber,
        column: label,
        message: `Column "${label}" is not a valid class date. Date columns must use YYYY-MM-DD.`,
      })
      continue
    }

    const dateISO = formatISODate(date)
    if (seenDates.has(dateISO)) {
      issues.push({
        severity: 'error',
        rowNumber: headerNumber,
        column: label,
        message: `Date column ${dateISO} appears more than once. Keep one column per class date.`,
      })
      continue
    }
    seenDates.add(dateISO)
    dateColumns.push({ columnNumber, label, date, dateISO })
  }

  if (dateColumns.length > MAX_DATE_COLUMNS) {
    issues.push({
      severity: 'error',
      message: `The sheet has ${dateColumns.length} date columns. The maximum is ${MAX_DATE_COLUMNS}.`,
    })
  }

  const rows: MatrixRow[] = []
  let totalMarks = 0
  const seenRows = new Set<string>()

  for (let rowNumber = headerNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const studentCode = studentCodeColumn ? cellText(row.getCell(studentCodeColumn)) : ''
    const studentName = studentNameColumn ? cellText(row.getCell(studentNameColumn)) : ''
    const batchCode = batchCodeColumn ? cellText(row.getCell(batchCodeColumn)) : ''

    const marks: MatrixMark[] = []
    for (const column of dateColumns) {
      const cell = row.getCell(column.columnNumber)
      const rawStatus = cellText(cell)
      if (!rawStatus) continue

      totalMarks += 1
      if (totalMarks > MAX_MARKS) {
        issues.push({
          severity: 'error',
          rowNumber,
          column: column.label,
          message: `This file has more than ${MAX_MARKS} attendance marks. Split it into smaller files.`,
        })
        return { rows, plans: [], issues, totalMarks, hasDateColumns: dateColumns.length > 0 }
      }

      const status = statusFromRaw(rawStatus)
      if (!status) {
        issues.push({
          severity: 'error',
          rowNumber,
          column: column.label,
          studentCode: studentCode || undefined,
          batchCode: batchCode || undefined,
          message: `"${rawStatus}" is not a valid status. Use PRESENT, ABSENT, LATE or EXCUSED.`,
        })
      }

      marks.push({
        columnNumber: column.columnNumber,
        columnLabel: column.label,
        date: column.date,
        dateISO: column.dateISO,
        rawStatus,
        status,
      })
    }

    if (marks.length === 0) continue

    if (!studentCode) {
      issues.push({
        severity: 'error',
        rowNumber,
        message: 'Student Code is required for rows with attendance marks.',
      })
    }
    if (!batchCode) {
      issues.push({
        severity: 'error',
        rowNumber,
        studentCode: studentCode || undefined,
        message: 'Batch Code is required for rows with attendance marks.',
      })
    }

    if (studentCode && batchCode) {
      const rowKey = `${studentCode.toUpperCase()}|${batchCode.toUpperCase()}`
      if (seenRows.has(rowKey)) {
        issues.push({
          severity: 'error',
          rowNumber,
          studentCode,
          batchCode,
          message: 'This student and batch appear more than once. Keep one row per student per batch.',
        })
      }
      seenRows.add(rowKey)
    }

    rows.push({ rowNumber, studentCode, studentName, batchCode, marks })
  }

  if (rows.length > MAX_MATRIX_ROWS) {
    issues.push({
      severity: 'error',
      message: `The sheet has ${rows.length} student rows. The maximum is ${MAX_MATRIX_ROWS}.`,
    })
  }

  return {
    rows,
    plans: [],
    issues,
    totalMarks,
    hasDateColumns: dateColumns.length > 0,
  }
}

function parsePlanSheet(sheet: ExcelJS.Worksheet | null): { plans: PlanRow[]; issues: ImportIssue[] } {
  if (!sheet) return { plans: [], issues: [] }

  const issues: ImportIssue[] = []
  const headerNumber = headerRowNumber(sheet, ['date', 'batchcode'])
  if (!headerNumber) {
    issues.push({
      severity: 'error',
      message: 'Session Plan must include "Date" and "Batch Code" columns.',
    })
    return { plans: [], issues }
  }

  const header = sheet.getRow(headerNumber)
  const columns: Record<string, number> = {}
  for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
    const key = normaliseHeader(cellText(header.getCell(columnNumber)))
    if (!key) continue
    if (
      key === 'date' ||
      key === 'batchcode' ||
      key === 'batch' ||
      key === 'topiccode' ||
      key === 'topic' ||
      key === 'starttime' ||
      key === 'endtime' ||
      key === 'description'
    ) {
      columns[key] = columnNumber
    }
  }

  const plans: PlanRow[] = []
  for (let rowNumber = headerNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const read = (key: string) => (columns[key] ? cellText(row.getCell(columns[key])) : '')
    const dateRaw = columns.date ? rawCell(row.getCell(columns.date).value) : null
    const date = dateFromRaw(dateRaw)
    const batchCode = read('batchcode') || read('batch')
    const topicCode = read('topiccode') || read('topic')
    const startTimeRaw = columns.starttime ? rawCell(row.getCell(columns.starttime).value) : null
    const endTimeRaw = columns.endtime ? rawCell(row.getCell(columns.endtime).value) : null
    const startTime = timeFromRaw(startTimeRaw)
    const endTime = timeFromRaw(endTimeRaw)
    const description = read('description') || null

    if (!date && !batchCode && !topicCode && !startTimeRaw && !endTimeRaw && !description) {
      continue
    }

    if (!date) {
      issues.push({
        severity: 'error',
        rowNumber,
        column: 'Date',
        message: 'Session Plan rows need a valid date in YYYY-MM-DD format.',
      })
      continue
    }
    if (!batchCode) {
      issues.push({
        severity: 'error',
        rowNumber,
        column: 'Batch Code',
        message: 'Session Plan rows need a batch code.',
      })
      continue
    }
    if (startTimeRaw && !startTime) {
      issues.push({
        severity: 'error',
        rowNumber,
        column: 'Start Time',
        message: 'Start Time must use HH:MM format.',
      })
    }
    if (endTimeRaw && !endTime) {
      issues.push({
        severity: 'error',
        rowNumber,
        column: 'End Time',
        message: 'End Time must use HH:MM format.',
      })
    }

    plans.push({
      rowNumber,
      date,
      dateISO: formatISODate(date),
      batchCode,
      topicCode,
      startTime,
      endTime,
      description,
    })
  }

  return { plans, issues }
}

async function parseWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  if (!buffer || buffer.length === 0) {
    throw new HttpError(400, 'Choose an Excel file to upload.')
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new HttpError(413, 'The workbook is larger than 10 MB. Split it into smaller files.')
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(new Uint8Array(buffer).buffer)
  } catch {
    throw new HttpError(400, 'Unable to read this workbook. Upload a valid .xlsx file.')
  }

  const sheet = attendanceSheet(workbook)
  const attendance = parseAttendanceSheet(sheet)
  const plan = parsePlanSheet(findSheet(workbook, PLAN_SHEET))

  return {
    rows: attendance.rows,
    plans: plan.plans,
    issues: [...attendance.issues, ...plan.issues],
    totalMarks: attendance.totalMarks,
    hasDateColumns: attendance.hasDateColumns,
  }
}

function assignmentCovers(
  assignments: { assignedAt: Date; endedAt: Date | null }[],
  date: Date,
): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  return assignments.some(
    (assignment) =>
      assignment.assignedAt <= dayEnd && (!assignment.endedAt || assignment.endedAt >= dayStart),
  )
}

function groupKey(batchCode: string, dateISO: string): string {
  return `${batchCode.trim().toUpperCase()}|${dateISO}`
}

function timeValue(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export async function analyseAttendanceImport(buffer: Buffer): Promise<Analysis> {
  const parsed = await parseWorkbook(buffer)
  const issues = [...parsed.issues]
  const today = startOfDay(new Date())

  if (!parsed.hasDateColumns) {
    issues.push({
      severity: 'error',
      message: 'No date columns found. Add one column per class date using YYYY-MM-DD headers.',
    })
  }
  if (parsed.totalMarks === 0) {
    issues.push({
      severity: 'error',
      message: 'No attendance marks found. Fill at least one date cell with PRESENT, ABSENT, LATE or EXCUSED.',
    })
  }

  const batches = await prisma.batch.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      startTime: true,
      endTime: true,
      trainerId: true,
      trainer: { select: { name: true } },
    },
  })
  const students = await prisma.student.findMany({
    select: { id: true, studentCode: true, name: true },
  })
  const assignments = await prisma.batchStudent.findMany({
    select: { studentId: true, batchId: true, assignedAt: true, endedAt: true },
  })
  const topics = await prisma.chessTopic.findMany({
    select: { id: true, code: true, name: true },
  })

  const batchByCode = new Map(batches.map((batch) => [batch.code.trim().toUpperCase(), batch]))
  const studentByCode = new Map(
    students.map((student) => [student.studentCode.trim().toUpperCase(), student]),
  )
  const topicByCode = new Map(topics.map((topic) => [topic.code.trim().toUpperCase(), topic]))
  const assignmentMap = new Map<string, { assignedAt: Date; endedAt: Date | null }[]>()
  for (const assignment of assignments) {
    const key = `${assignment.studentId}|${assignment.batchId}`
    const list = assignmentMap.get(key) ?? []
    list.push({ assignedAt: assignment.assignedAt, endedAt: assignment.endedAt })
    assignmentMap.set(key, list)
  }

  const planByKey = new Map<string, PlanRow>()
  for (const plan of parsed.plans) {
    const key = groupKey(plan.batchCode, plan.dateISO)
    const existing = planByKey.get(key)
    if (existing) {
      issues.push({
        severity: 'error',
        rowNumber: plan.rowNumber,
        column: 'Session Plan',
        batchCode: plan.batchCode,
        message: `Session Plan has more than one row for ${plan.batchCode} on ${plan.dateISO}. Keep one row per batch and date.`,
      })
      continue
    }
    planByKey.set(key, plan)
  }

  interface CandidateGroup {
    batch: (typeof batches)[number]
    date: Date
    dateISO: string
    plan: PlanRow | null
    marks: GroupMark[]
  }

  const candidates = new Map<string, CandidateGroup>()
  let validMarks = 0
  let totalRows = 0

  for (const row of parsed.rows) {
    if (!row.studentCode || !row.batchCode) continue
    totalRows += 1

    const batch = batchByCode.get(row.batchCode.trim().toUpperCase())
    const student = studentByCode.get(row.studentCode.trim().toUpperCase())
    if (!batch) {
      issues.push({
        severity: 'error',
        rowNumber: row.rowNumber,
        studentCode: row.studentCode,
        batchCode: row.batchCode,
        message: `Batch code "${row.batchCode}" was not found.`,
      })
      continue
    }
    if (!student) {
      issues.push({
        severity: 'error',
        rowNumber: row.rowNumber,
        studentCode: row.studentCode,
        batchCode: row.batchCode,
        message: `Student code "${row.studentCode}" was not found.`,
      })
      continue
    }
    if (row.studentName && row.studentName.trim().toUpperCase() !== student.name.trim().toUpperCase()) {
      issues.push({
        severity: 'warning',
        rowNumber: row.rowNumber,
        studentCode: row.studentCode,
        batchCode: row.batchCode,
        message: `Student name "${row.studentName}" does not match "${student.name}". The student code will be used.`,
      })
    }

    const studentAssignments = assignmentMap.get(`${student.id}|${batch.id}`) ?? []

    for (const mark of row.marks) {
      if (!mark.status) continue
      if (mark.date > today) {
        issues.push({
          severity: 'error',
          rowNumber: row.rowNumber,
          column: mark.columnLabel,
          studentCode: row.studentCode,
          batchCode: row.batchCode,
          message: `The date ${mark.dateISO} is in the future.`,
        })
        continue
      }
      if (!assignmentCovers(studentAssignments, mark.date)) {
        issues.push({
          severity: 'error',
          rowNumber: row.rowNumber,
          column: mark.columnLabel,
          studentCode: row.studentCode,
          batchCode: row.batchCode,
          message: `${student.studentCode} was not assigned to ${batch.code} on ${mark.dateISO}.`,
        })
        continue
      }

      validMarks += 1
      const key = groupKey(batch.code, mark.dateISO)
      const group =
        candidates.get(key) ??
        {
          batch,
          date: mark.date,
          dateISO: mark.dateISO,
          plan: planByKey.get(key) ?? null,
          marks: [],
        }
      group.marks.push({
        studentId: student.id,
        studentCode: student.studentCode,
        studentName: student.name,
        status: mark.status,
        rowNumber: row.rowNumber,
        columnLabel: mark.columnLabel,
      })
      candidates.set(key, group)
    }
  }

  const minDate = Array.from(candidates.values()).reduce<Date | null>(
    (earliest, group) => (!earliest || group.date < earliest ? group.date : earliest),
    null,
  )
  const maxDate = Array.from(candidates.values()).reduce<Date | null>(
    (latest, group) => (!latest || group.date > latest ? group.date : latest),
    null,
  )
  const batchIds = Array.from(new Set(Array.from(candidates.values()).map((group) => group.batch.id)))

  const existingSessions =
    minDate && maxDate && batchIds.length > 0
      ? await prisma.classSession.findMany({
          where: {
            batchId: { in: batchIds },
            date: { gte: minDate, lte: endOfDay(maxDate) },
          },
          select: {
            id: true,
            batchId: true,
            trainerId: true,
            topicId: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            topic: { select: { id: true, code: true, name: true } },
            trainer: { select: { name: true } },
          },
        })
      : []

  const sessionsByKey = new Map<string, typeof existingSessions>()
  for (const session of existingSessions) {
    const key = `${session.batchId}|${formatISODate(session.date)}`
    const list = sessionsByKey.get(key) ?? []
    list.push(session)
    sessionsByKey.set(key, list)
  }

  const resolvedGroups: {
    group: CandidateGroup
    existing: (typeof existingSessions)[number] | null
    blocked: boolean
  }[] = []

  for (const group of candidates.values()) {
    let blocked = false
    const plan = group.plan
    const groupIssues = (message: string) => {
      issues.push({
        severity: 'error',
        rowNumber: plan?.rowNumber,
        column: plan ? 'Session Plan' : group.dateISO,
        batchCode: group.batch.code,
        message,
      })
      blocked = true
    }

    let existingList = sessionsByKey.get(`${group.batch.id}|${group.dateISO}`) ?? []
    if (existingList.length > 1) {
      if (plan?.startTime) {
        const filtered = existingList.filter((session) => session.startTime === plan.startTime)
        if (filtered.length === 1) {
          existingList = filtered
        } else {
          groupIssues(
            `Multiple sessions exist for ${group.batch.code} on ${group.dateISO}. Add a matching Start Time to Session Plan.`,
          )
        }
      } else {
        groupIssues(
          `Multiple sessions exist for ${group.batch.code} on ${group.dateISO}. Add a Start Time to Session Plan to choose one.`,
        )
      }
    }
    const existing = existingList[0] ?? null

    if (existing && existing.status === 'CANCELLED') {
      groupIssues(`The session for ${group.batch.code} on ${group.dateISO} was cancelled.`)
    }

    let planTopic: { id: string; code: string; name: string } | null = null
    if (plan?.topicCode) {
      planTopic = topicByCode.get(plan.topicCode.trim().toUpperCase()) ?? null
      if (!planTopic) {
        groupIssues(`Topic code "${plan.topicCode}" was not found.`)
      }
    }

    if (existing && planTopic && existing.topicId && existing.topicId !== planTopic.id) {
      groupIssues(
        `Session Plan topic "${planTopic.code}" does not match the existing session topic "${existing.topic?.code ?? 'unknown'}".`,
      )
    }

    const startTime = existing?.startTime ?? plan?.startTime ?? group.batch.startTime
    const endTime = existing?.endTime ?? plan?.endTime ?? group.batch.endTime
    if (timeValue(startTime) >= timeValue(endTime)) {
      groupIssues(`Class times for ${group.batch.code} on ${group.dateISO} are invalid.`)
    }

    const trainerId = existing?.trainerId ?? group.batch.trainerId
    const trainerName = existing?.trainer?.name ?? group.batch.trainer?.name ?? null
    if (!existing && !trainerId) {
      groupIssues(`Batch ${group.batch.code} has no trainer assigned, so a class session cannot be created.`)
    }

    resolvedGroups.push({ group, existing, blocked })
  }

  const sessionIds = resolvedGroups
    .map((entry) => entry.existing?.id)
    .filter((id): id is string => Boolean(id))
  const existingAttendance =
    sessionIds.length > 0
      ? await prisma.studentAttendance.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true, studentId: true },
        })
      : []
  const attendanceSet = new Set(
    existingAttendance.map((record) => `${record.sessionId}|${record.studentId}`),
  )

  const groups: AnalysedGroup[] = []
  let newRecords = 0
  let skippedRecords = 0
  let sessionsToCreate = 0
  let sessionsToReuse = 0
  let sessionsSkipped = 0
  const usedPlanKeys = new Set<string>()

  for (const entry of resolvedGroups) {
    const { group, existing, blocked } = entry
    const plan = group.plan
    if (plan) usedPlanKeys.add(groupKey(plan.batchCode, plan.dateISO))

    let topicId = existing?.topicId ?? null
    let topicCode = existing?.topic?.code ?? null
    let topicName = existing?.topic?.name ?? null
    if (plan?.topicCode && !blocked) {
      const planTopic = topicByCode.get(plan.topicCode.trim().toUpperCase())
      if (planTopic) {
        if (!existing) {
          topicId = planTopic.id
          topicCode = planTopic.code
          topicName = planTopic.name
        } else if (!existing.topicId) {
          topicId = planTopic.id
          topicCode = planTopic.code
          topicName = planTopic.name
        }
      }
    }

    const newGroupRecords: GroupMark[] = []
    let groupSkipped = 0
    for (const mark of group.marks) {
      if (existing && attendanceSet.has(`${existing.id}|${mark.studentId}`)) {
        groupSkipped += 1
      } else {
        newGroupRecords.push(mark)
      }
    }

    const action: AnalysedGroup['action'] = blocked
      ? 'blocked'
      : newGroupRecords.length === 0
        ? 'skip'
        : existing
          ? 'reuse'
          : 'create'

    if (action === 'create') sessionsToCreate += 1
    if (action === 'reuse') sessionsToReuse += 1
    if (action === 'skip') sessionsSkipped += 1
    if (action !== 'blocked') {
      newRecords += newGroupRecords.length
      skippedRecords += groupSkipped
    }

    groups.push({
      batchId: group.batch.id,
      batchCode: group.batch.code,
      batchName: group.batch.name,
      date: group.date,
      dateISO: group.dateISO,
      startTime: existing?.startTime ?? plan?.startTime ?? group.batch.startTime,
      endTime: existing?.endTime ?? plan?.endTime ?? group.batch.endTime,
      topicId,
      topicCode,
      topicName,
      trainerId: existing?.trainerId ?? group.batch.trainerId,
      trainerName: existing?.trainer?.name ?? group.batch.trainer?.name ?? null,
      planRowNumber: plan?.rowNumber ?? null,
      existingSessionId: existing?.id ?? null,
      existingTopicId: existing?.topicId ?? null,
      existingStatus: existing?.status ?? null,
      action,
      newRecords: newGroupRecords,
      skippedRecords: groupSkipped,
    })
  }

  for (const [key, plan] of planByKey) {
    if (!usedPlanKeys.has(key)) {
      issues.push({
        severity: 'warning',
        rowNumber: plan.rowNumber,
        column: 'Session Plan',
        batchCode: plan.batchCode,
        message: `No attendance marks were found for ${plan.batchCode} on ${plan.dateISO}; this Session Plan row was ignored.`,
      })
    }
  }

  groups.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.batchCode.localeCompare(b.batchCode))

  const summary: ImportSummary = {
    totalRows,
    totalMarks: parsed.totalMarks,
    validMarks,
    newRecords,
    skippedRecords,
    sessionsToCreate,
    sessionsToReuse,
    sessionsSkipped,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
  }

  return {
    summary,
    sessions: groups.map((group) => ({
      date: group.dateISO,
      batchCode: group.batchCode,
      batchName: group.batchName,
      topicCode: group.topicCode,
      topicName: group.topicName,
      trainerName: group.trainerName,
      startTime: group.startTime,
      endTime: group.endTime,
      action: group.action,
      newRecords: group.newRecords.length,
      skippedRecords: group.skippedRecords,
    })),
    issues,
    groups,
    errors: summary.errors,
  }
}

export async function commitAttendanceImport(
  analysis: Analysis,
  actorId: string,
  fileName: string,
): Promise<ImportResult> {
  if (analysis.errors > 0) {
    throw new HttpError(400, 'Fix the validation errors before importing this workbook.')
  }

  const result = await prisma.$transaction(
    async (tx) => {
      let imported = 0
      let skipped = 0
      let createdSessions = 0
      let reusedSessions = 0
      let skippedSessions = 0

      for (const group of analysis.groups) {
        if (group.action === 'skip' || group.newRecords.length === 0) {
          skippedSessions += 1
          skipped += group.skippedRecords
          continue
        }

        let sessionId = group.existingSessionId
        if (!sessionId) {
          if (!group.trainerId) {
            throw new HttpError(400, `Batch ${group.batchCode} has no trainer assigned.`)
          }
          const session = await tx.classSession.create({
            data: {
              batchId: group.batchId,
              trainerId: group.trainerId,
              topicId: group.topicId,
              date: group.date,
              startTime: group.startTime,
              endTime: group.endTime,
              status: 'COMPLETED',
            },
            select: { id: true },
          })
          sessionId = session.id
          createdSessions += 1
        } else {
          const data: {
            status: 'COMPLETED'
            topicId?: string
          } = { status: 'COMPLETED' }
          if (!group.existingTopicId && group.topicId) {
            data.topicId = group.topicId
          }
          await tx.classSession.update({ where: { id: sessionId }, data })
          reusedSessions += 1
        }

        const inserted = await tx.studentAttendance.createMany({
          data: group.newRecords.map((record) => ({
            sessionId: sessionId as string,
            studentId: record.studentId,
            status: record.status,
            remarks: null,
            markedById: actorId,
          })),
          skipDuplicates: true,
        })
        imported += inserted.count
        skipped += group.skippedRecords + (group.newRecords.length - inserted.count)
      }

      return { imported, skipped, createdSessions, reusedSessions, skippedSessions }
    },
    { timeout: 60_000 },
  )

  if (result.imported > 0) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: 'ATTENDANCE_IMPORTED',
        entity: 'StudentAttendance',
        entityId: null,
        after: {
          fileName,
          imported: result.imported,
          skipped: result.skipped,
          createdSessions: result.createdSessions,
          reusedSessions: result.reusedSessions,
          skippedSessions: result.skippedSessions,
          totalMarks: analysis.summary.totalMarks,
        },
      },
    })
  }

  return {
    ...result,
    totalMarks: analysis.summary.totalMarks,
  }
}

function dateStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function parseTemplateRange(fromRaw: string | undefined, toRaw: string | undefined): {
  from: Date
  to: Date
} {
  const today = startOfDay(new Date())
  const defaultFrom = new Date(today)
  defaultFrom.setDate(defaultFrom.getDate() - 29)

  const from = fromRaw ? dateFromRaw(fromRaw) : defaultFrom
  const to = toRaw ? dateFromRaw(toRaw) : today
  if (!from || !to) {
    throw new HttpError(400, 'Choose a valid template date range.')
  }
  if (from > to) {
    throw new HttpError(400, 'The template start date must be before the end date.')
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  if (days > MAX_TEMPLATE_DAYS) {
    throw new HttpError(400, `The template can cover at most ${MAX_TEMPLATE_DAYS} days.`)
  }
  if (to > today) {
    throw new HttpError(400, 'The template end date cannot be in the future.')
  }
  return { from, to }
}

export async function buildAttendanceImportTemplate(options: {
  from?: string
  to?: string
  batchId?: string | null
}): Promise<{ buffer: Buffer; filename: string }> {
  const { from, to } = parseTemplateRange(options.from, options.to)

  const batches = await prisma.batch.findMany({
    where: options.batchId ? { id: options.batchId } : {},
    select: {
      id: true,
      code: true,
      name: true,
      days: true,
      startTime: true,
      endTime: true,
      isActive: true,
      trainer: { select: { name: true } },
    },
    orderBy: { code: 'asc' },
  })
  if (options.batchId && batches.length === 0) {
    throw new HttpError(404, 'Batch not found.')
  }

  const batchIds = batches.map((batch) => batch.id)
  const assignments =
    batchIds.length > 0
      ? await prisma.batchStudent.findMany({
          where: {
            batchId: { in: batchIds },
            assignedAt: { lte: endOfDay(to) },
            OR: [{ endedAt: null }, { endedAt: { gte: startOfDay(from) } }],
          },
          select: {
            assignedAt: true,
            endedAt: true,
            student: {
              select: { studentCode: true, name: true, status: true },
            },
            batch: {
              select: { id: true, code: true, name: true, startTime: true, endTime: true },
            },
          },
        })
      : []

  assignments.sort(
    (a, b) =>
      a.batch.code.localeCompare(b.batch.code) ||
      a.student.studentCode.localeCompare(b.student.studentCode),
  )

  const topics = await prisma.chessTopic.findMany({
    select: { code: true, name: true, category: true },
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  })

  const dates: Date[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChessBishop Academy'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(ATTENDANCE_SHEET, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Student Code', key: 'studentCode', width: 16 },
    { header: 'Student Name', key: 'studentName', width: 26 },
    { header: 'Batch Code', key: 'batchCode', width: 14 },
    ...dates.map((date) => ({
      header: formatISODate(date),
      key: formatISODate(date),
      width: 13,
    })),
  ]

  const header = sheet.getRow(1)
  header.height = 30
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  const seenTemplateRows = new Set<string>()
  for (const assignment of assignments) {
    const rowKey = `${assignment.student.studentCode.toUpperCase()}|${assignment.batch.code.toUpperCase()}`
    if (seenTemplateRows.has(rowKey)) continue
    seenTemplateRows.add(rowKey)
    sheet.addRow([
      assignment.student.studentCode,
      assignment.student.name,
      assignment.batch.code,
      ...dates.map(() => ''),
    ])
  }

  const lastRow = Math.max(2, sheet.rowCount)
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    for (let columnNumber = 4; columnNumber <= 3 + dates.length; columnNumber += 1) {
      const cell = sheet.getRow(rowNumber).getCell(columnNumber)
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"PRESENT,ABSENT,LATE,EXCUSED"'],
        showErrorMessage: true,
        errorTitle: 'Invalid attendance status',
        error: 'Choose PRESENT, ABSENT, LATE or EXCUSED, or leave the cell blank.',
      }
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: 3 + dates.length },
  }

  const planSheet = workbook.addWorksheet(PLAN_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  planSheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Batch Code', key: 'batchCode', width: 15 },
    { header: 'Topic Code', key: 'topicCode', width: 15 },
    { header: 'Start Time', key: 'startTime', width: 13 },
    { header: 'End Time', key: 'endTime', width: 13 },
    { header: 'Description', key: 'description', width: 40 },
  ]
  const planHeader = planSheet.getRow(1)
  planHeader.height = 24
  planHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  planSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 100, column: 6 } }

  const batchSheet = workbook.addWorksheet('Batches', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  batchSheet.columns = [
    { header: 'Batch Code', key: 'code', width: 15 },
    { header: 'Batch Name', key: 'name', width: 28 },
    { header: 'Trainer', key: 'trainer', width: 24 },
    { header: 'Class Days', key: 'days', width: 28 },
    { header: 'Start', key: 'start', width: 10 },
    { header: 'End', key: 'end', width: 10 },
    { header: 'Status', key: 'status', width: 11 },
  ]
  for (const batch of batches) {
    batchSheet.addRow({
      code: batch.code,
      name: batch.name,
      trainer: batch.trainer?.name ?? 'No trainer',
      days: batch.days,
      start: batch.startTime,
      end: batch.endTime,
      status: batch.isActive ? 'ACTIVE' : 'INACTIVE',
    })
  }
  const batchHeader = batchSheet.getRow(1)
  batchHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  })

  const topicSheet = workbook.addWorksheet('Topics', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  topicSheet.columns = [
    { header: 'Topic Code', key: 'code', width: 16 },
    { header: 'Topic Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 24 },
  ]
  for (const topic of topics) {
    topicSheet.addRow({ code: topic.code, name: topic.name, category: topic.category })
  }
  const topicHeader = topicSheet.getRow(1)
  topicHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  })

  const instructions = workbook.addWorksheet('Instructions')
  instructions.columns = [{ width: 120 }]
  instructions.addRow(['ChessBishop attendance import'])
  instructions.getRow(1).font = { size: 18, bold: true, color: { argb: HEADER_FILL } }
  instructions.addRow([])
  const instructionLines = [
    'HOW TO USE',
    '1. Fill the attendance statuses in the Attendance sheet.',
    '2. Leave a cell blank when there was no class or you do not want to import that student.',
    '3. Blank does not mean absent. Enter ABSENT explicitly where needed.',
    '4. Use one row per student and batch. A student in two batches needs two rows.',
    '5. Date columns must stay in YYYY-MM-DD format.',
    '',
    'STATUSES',
    'PRESENT, ABSENT, LATE, EXCUSED. Blank cells are ignored.',
    '',
    'SESSION PLAN (OPTIONAL)',
    'Add one row per batch and date if you want to set a topic or class time.',
    'If a batch already has more than one session on that date, set the matching Start Time.',
    'When no session exists, the importer creates a COMPLETED session using the batch schedule.',
    '',
    'WHAT HAPPENS ON IMPORT',
    'Existing attendance is always skipped. New marks are added and existing records are never overwritten.',
    'If any validation error is found, nothing is imported until the workbook is fixed.',
    'Admin access is required.',
    '',
    'LIMITS',
    `Up to ${MAX_MATRIX_ROWS} student rows, ${MAX_DATE_COLUMNS} date columns, ${MAX_MARKS} marks and 10 MB per file.`,
  ]
  for (const line of instructionLines) {
    const row = instructions.addRow([line])
    if (line === 'HOW TO USE' || line === 'STATUSES' || line === 'SESSION PLAN (OPTIONAL)' || line === 'WHAT HAPPENS ON IMPORT' || line === 'LIMITS') {
      row.font = { bold: true, color: { argb: HEADER_FILL } }
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_FILL } }
    }
    row.alignment = { vertical: 'middle', wrapText: true }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer: Buffer.from(buffer),
    filename: `chessbishop-attendance-template-${dateStamp(from)}-${dateStamp(to)}.xlsx`,
  }
}
