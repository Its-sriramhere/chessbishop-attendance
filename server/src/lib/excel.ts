import ExcelJS from 'exceljs'
import type { AttendanceStatus, Level, SessionStatus } from '@prisma/client'
import type { AttendanceReport } from '../services/attendance'

const HEADER_FILL = 'FF0A1029'
const HEADER_FONT = 'FFFFFFFF'
const ACCENT_FILL = 'FFEDE9FE'

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'FF15803D',
  ABSENT: 'FFB91C1C',
  LATE: 'FFB45309',
  EXCUSED: 'FF6D28D9',
  SCHEDULED: 'FF1D4ED8',
  COMPLETED: 'FF15803D',
  CANCELLED: 'FFB91C1C',
  RESCHEDULED: 'FFB45309',
}

export interface StudentDetail {
  id: string
  studentCode: string
  name: string
  dob: Date | null
  guardianName: string | null
  contact: string | null
  email: string | null
  level: Level
  joiningDate: Date
  status: string
  batches: { code: string; name: string }[]
}

export interface BatchDetail {
  code: string
  name: string
  level: Level
  trainerName: string | null
  daysLabel: string
  startTime: string
  endTime: string
  durationMin: number
  studentCount: number
  isActive: boolean
}

export interface FacultyDetail {
  employeeId: string
  name: string
  email: string
  phone: string | null
  joinedAt: Date
  batchCount: number
  sessionCount: number
  isActive: boolean
}

export interface SessionDetail {
  date: Date
  startTime: string
  endTime: string
  status: SessionStatus
  batchCode: string
  batchName: string
  trainerName: string
  topicName: string | null
  attendanceCount: number
  description: string | null
}

export interface AttendanceRecord {
  date: Date
  batchCode: string
  batchName: string
  studentCode: string
  studentName: string
  status: AttendanceStatus
  remarks: string | null
  trainerName: string
  topicName: string | null
  category: string | null
}

export interface TopicDetail {
  code: string
  name: string
  category: string
  difficulty: Level
  estimatedMinutes: number | null
  sessionCount: number
  description: string | null
}

export interface WorkbookData {
  report: AttendanceReport
  students: StudentDetail[]
  batches: BatchDetail[]
  faculty: FacultyDetail[]
  sessions: SessionDetail[]
  records: AttendanceRecord[]
  topics: TopicDetail[]
  generatedBy: string
}

function percentValue(attended: number, eligible: number, excluded: number): number | null {
  const denominator = eligible - excluded
  if (denominator <= 0) return null
  return Math.round((attended / denominator) * 1000) / 10
}

function isAttended(status: AttendanceStatus, lateCountsAsPresent: boolean): boolean {
  return status === 'PRESENT' || (status === 'LATE' && lateCountsAsPresent)
}

function createSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Partial<ExcelJS.Column>[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  sheet.columns = columns

  const header = sheet.getRow(1)
  header.height = 24
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })

  return sheet
}

function finaliseSheet(sheet: ExcelJS.Worksheet): void {
  if (sheet.rowCount > 1) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: sheet.columnCount },
    }
  }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: 'middle' }
    }
  })
}

function paintStatus(sheet: ExcelJS.Worksheet, key: string): void {
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const value = String(row.getCell(key).value ?? '')
    const color = STATUS_COLORS[value]
    if (color) {
      row.getCell(key).font = { color: { argb: color }, bold: true }
    }
  })
}

function riskFor(value: number | null): string {
  if (value === null) return 'No Data'
  if (value >= 90) return 'Excellent'
  if (value >= 75) return 'Good'
  if (value >= 50) return 'At Risk'
  return 'Critical'
}

export async function buildAttendanceWorkbook(data: WorkbookData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChessBishop Academy'
  workbook.created = new Date()

  const policy = data.report.policy
  const studentStats = new Map(data.report.studentStats.map((stats) => [stats.id, stats]))

  // 01 Student Details
  const studentSheet = createSheet(workbook, '01 Student Details', [
    { header: 'Student ID', key: 'code', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Date of Birth', key: 'dob', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Parent / Guardian', key: 'guardian', width: 24 },
    { header: 'Contact', key: 'contact', width: 18 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Level', key: 'level', width: 15 },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Batch', key: 'batch', width: 24 },
    { header: 'Joining Date', key: 'joined', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Attendance %', key: 'attendance', width: 13, style: { numFmt: '0.0"%"' } },
    { header: 'Risk', key: 'risk', width: 12 },
  ])
  for (const student of data.students) {
    const stats = studentStats.get(student.id)
    studentSheet.addRow({
      code: student.studentCode,
      name: student.name,
      dob: student.dob,
      guardian: student.guardianName,
      contact: student.contact,
      email: student.email,
      level: student.level,
      status: student.status,
      batch: student.batches.map((batch) => `${batch.code} - ${batch.name}`).join('; '),
      joined: student.joiningDate,
      attendance: stats?.attendance ?? null,
      risk: stats?.risk ?? 'No Data',
    })
  }
  finaliseSheet(studentSheet)
  paintStatus(studentSheet, 'status')

  // 02 Faculty Details
  const facultySheet = createSheet(workbook, '02 Faculty Details', [
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Joined', key: 'joined', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Batches', key: 'batches', width: 10 },
    { header: 'Classes', key: 'sessions', width: 10 },
    { header: 'Status', key: 'status', width: 11 },
  ])
  for (const member of data.faculty) {
    facultySheet.addRow({
      employeeId: member.employeeId,
      name: member.name,
      email: member.email,
      phone: member.phone,
      joined: member.joinedAt,
      batches: member.batchCount,
      sessions: member.sessionCount,
      status: member.isActive ? 'ACTIVE' : 'INACTIVE',
    })
  }
  finaliseSheet(facultySheet)

  // 03 Batch Details
  const batchSheet = createSheet(workbook, '03 Batch Details', [
    { header: 'Batch ID', key: 'code', width: 12 },
    { header: 'Batch Name', key: 'name', width: 24 },
    { header: 'Level', key: 'level', width: 15 },
    { header: 'Trainer', key: 'trainer', width: 22 },
    { header: 'Students', key: 'students', width: 10 },
    { header: 'Class Days', key: 'days', width: 28 },
    { header: 'Class Time', key: 'time', width: 16 },
    { header: 'Duration (min)', key: 'duration', width: 14 },
    { header: 'Status', key: 'status', width: 11 },
  ])
  for (const batch of data.batches) {
    batchSheet.addRow({
      code: batch.code,
      name: batch.name,
      level: batch.level,
      trainer: batch.trainerName,
      students: batch.studentCount,
      days: batch.daysLabel,
      time: `${batch.startTime} - ${batch.endTime}`,
      duration: batch.durationMin,
      status: batch.isActive ? 'ACTIVE' : 'INACTIVE',
    })
  }
  finaliseSheet(batchSheet)

  // 04 Class Schedule
  const scheduleSheet = createSheet(workbook, '04 Class Schedule', [
    { header: 'Date', key: 'date', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Batch', key: 'batch', width: 26 },
    { header: 'Trainer', key: 'trainer', width: 22 },
    { header: 'Chess Topic', key: 'topic', width: 26 },
    { header: 'Start', key: 'start', width: 9 },
    { header: 'End', key: 'end', width: 9 },
    { header: 'Status', key: 'status', width: 13 },
    { header: 'Attendance Records', key: 'records', width: 19 },
    { header: 'Description', key: 'description', width: 42 },
  ])
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (const session of data.sessions) {
    scheduleSheet.addRow({
      date: session.date,
      day: dayNames[session.date.getDay()],
      batch: `${session.batchCode} - ${session.batchName}`,
      trainer: session.trainerName,
      topic: session.topicName ?? '—',
      start: session.startTime,
      end: session.endTime,
      status: session.status,
      records: session.attendanceCount,
      description: session.description,
    })
  }
  finaliseSheet(scheduleSheet)
  paintStatus(scheduleSheet, 'status')

  // 05 Chess Topic Register
  const topicSheet = createSheet(workbook, '05 Chess Topic Register', [
    { header: 'Topic ID', key: 'code', width: 12 },
    { header: 'Topic Name', key: 'name', width: 28 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Difficulty', key: 'difficulty', width: 15 },
    { header: 'Est. Minutes', key: 'minutes', width: 12 },
    { header: 'Sessions', key: 'sessions', width: 10 },
    { header: 'Description', key: 'description', width: 52 },
  ])
  for (const topic of data.topics) {
    topicSheet.addRow({
      code: topic.code,
      name: topic.name,
      category: topic.category,
      difficulty: topic.difficulty,
      minutes: topic.estimatedMinutes,
      sessions: topic.sessionCount,
      description: topic.description,
    })
  }
  finaliseSheet(topicSheet)

  // 06 Daily Attendance
  const dailySheet = createSheet(workbook, '06 Daily Attendance', [
    { header: 'Date', key: 'date', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Batch', key: 'batch', width: 26 },
    { header: 'Student ID', key: 'studentCode', width: 14 },
    { header: 'Student Name', key: 'studentName', width: 24 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Chess Topic', key: 'topic', width: 26 },
    { header: 'Remarks', key: 'remarks', width: 36 },
    { header: 'Trainer', key: 'trainer', width: 22 },
  ])
  for (const record of data.records) {
    dailySheet.addRow({
      date: record.date,
      batch: `${record.batchCode} - ${record.batchName}`,
      studentCode: record.studentCode,
      studentName: record.studentName,
      status: record.status,
      topic: record.topicName ?? '—',
      remarks: record.remarks,
      trainer: record.trainerName,
    })
  }
  finaliseSheet(dailySheet)
  paintStatus(dailySheet, 'status')

  // 07 Monthly Attendance
  const monthlyMap = new Map<
    string,
    { label: string; batch: string; studentCode: string; studentName: string; eligible: number; attended: number; excluded: number }
  >()
  for (const record of data.records) {
    const date = record.date
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${record.studentCode}`
    const label = `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`
    const entry =
      monthlyMap.get(key) ??
      {
        label,
        batch: `${record.batchCode} - ${record.batchName}`,
        studentCode: record.studentCode,
        studentName: record.studentName,
        eligible: 0,
        attended: 0,
        excluded: 0,
      }
    entry.eligible += 1
    if (isAttended(record.status, policy.lateCountsAsPresent)) entry.attended += 1
    if (record.status === 'EXCUSED' && policy.excusedExcluded) entry.excluded += 1
    monthlyMap.set(key, entry)
  }

  const monthlySheet = createSheet(workbook, '07 Monthly Attendance', [
    { header: 'Month', key: 'month', width: 14 },
    { header: 'Batch', key: 'batch', width: 26 },
    { header: 'Student ID', key: 'studentCode', width: 14 },
    { header: 'Student Name', key: 'studentName', width: 24 },
    { header: 'Eligible', key: 'eligible', width: 10 },
    { header: 'Attended', key: 'attended', width: 10 },
    { header: 'Attendance %', key: 'attendance', width: 13, style: { numFmt: '0.0"%"' } },
    { header: 'Risk', key: 'risk', width: 12 },
  ])
  for (const entry of monthlyMap.values()) {
    const value = percentValue(entry.attended, entry.eligible, entry.excluded)
    monthlySheet.addRow({
      month: entry.label,
      batch: entry.batch,
      studentCode: entry.studentCode,
      studentName: entry.studentName,
      eligible: entry.eligible,
      attended: entry.attended,
      attendance: value,
      risk: riskFor(value),
    })
  }
  finaliseSheet(monthlySheet)

  // 08 Topic-wise Attendance
  const topicMap = new Map<
    string,
    { topic: string; category: string; batch: string; eligible: number; attended: number; excluded: number }
  >()
  for (const record of data.records) {
    const key = `${record.topicName ?? 'Unassigned'}-${record.category ?? 'General'}-${record.batchCode}`
    const entry =
      topicMap.get(key) ??
      {
        topic: record.topicName ?? 'Unassigned',
        category: record.category ?? 'General',
        batch: `${record.batchCode} - ${record.batchName}`,
        eligible: 0,
        attended: 0,
        excluded: 0,
      }
    entry.eligible += 1
    if (isAttended(record.status, policy.lateCountsAsPresent)) entry.attended += 1
    if (record.status === 'EXCUSED' && policy.excusedExcluded) entry.excluded += 1
    topicMap.set(key, entry)
  }

  const topicAttendanceSheet = createSheet(workbook, '08 Topic-wise Attendance', [
    { header: 'Chess Topic', key: 'topic', width: 28 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Batch', key: 'batch', width: 26 },
    { header: 'Eligible', key: 'eligible', width: 10 },
    { header: 'Attended', key: 'attended', width: 10 },
    { header: 'Attendance %', key: 'attendance', width: 13, style: { numFmt: '0.0"%"' } },
  ])
  for (const entry of topicMap.values()) {
    topicAttendanceSheet.addRow({
      topic: entry.topic,
      category: entry.category,
      batch: entry.batch,
      eligible: entry.eligible,
      attended: entry.attended,
      attendance: percentValue(entry.attended, entry.eligible, entry.excluded),
    })
  }
  finaliseSheet(topicAttendanceSheet)

  // 09 Attendance Analytics
  const analyticsSheet = workbook.addWorksheet('09 Attendance Analytics')
  analyticsSheet.columns = [
    { width: 3 },
    { width: 30 },
    { width: 24 },
    { width: 3 },
    { width: 16 },
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ]
  const titleCell = analyticsSheet.getCell('B2')
  titleCell.value = 'Attendance Analytics Summary'
  titleCell.font = { bold: true, size: 15, color: { argb: HEADER_FILL } }
  const policyLabel = `Late counts as present: ${policy.lateCountsAsPresent ? 'Yes' : 'No'} | Excused excluded from denominator: ${policy.excusedExcluded ? 'Yes' : 'No'}`
  analyticsSheet.getCell('B3').value = policyLabel
  analyticsSheet.getCell('B3').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }

  const metrics: [string, string | number][] = [
    ['Generated On', new Date().toLocaleString()],
    ['Generated By', data.generatedBy],
    ['Overall Attendance', data.report.totals.attendance ?? 'No Data'],
    ['Total Students', data.report.totals.students],
    ['Completed Sessions', data.report.totals.sessions],
    ['Students Below 75%', data.report.totals.lowAttendance],
    ['Excellent (90-100%)', data.report.risk.excellent],
    ['Good (75-89%)', data.report.risk.good],
    ['At Risk (50-74%)', data.report.risk.atRisk],
    ['Critical (below 50%)', data.report.risk.critical],
    ['No Data', data.report.risk.noData],
  ]

  let rowNumber = 5
  for (const [label, value] of metrics) {
    analyticsSheet.getCell(rowNumber, 2).value = label
    analyticsSheet.getCell(rowNumber, 2).font = { bold: true, size: 11 }
    const valueCell = analyticsSheet.getCell(rowNumber, 3)
    valueCell.value = value
    valueCell.alignment = { horizontal: 'left' }
    if (label === 'Overall Attendance' && typeof value === 'number') {
      valueCell.numFmt = '0.0"%"'
    }
    rowNumber += 1
  }

  const batchHeaderRow = 5
  analyticsSheet.getCell(batchHeaderRow, 5).value = 'Batch Code'
  analyticsSheet.getCell(batchHeaderRow, 6).value = 'Batch Name'
  analyticsSheet.getCell(batchHeaderRow, 7).value = 'Students'
  analyticsSheet.getCell(batchHeaderRow, 8).value = 'Sessions'
  analyticsSheet.getCell(batchHeaderRow, 9).value = 'Attendance %'
  for (let column = 5; column <= 9; column += 1) {
    const cell = analyticsSheet.getCell(batchHeaderRow, column)
    cell.font = { bold: true, color: { argb: HEADER_FONT } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  }

  let batchRow = batchHeaderRow + 1
  for (const batch of data.report.batchStats) {
    analyticsSheet.getCell(batchRow, 5).value = batch.code
    analyticsSheet.getCell(batchRow, 6).value = batch.name
    analyticsSheet.getCell(batchRow, 7).value = batch.students
    analyticsSheet.getCell(batchRow, 8).value = batch.sessions
    const valueCell = analyticsSheet.getCell(batchRow, 9)
    valueCell.value = batch.attendance
    valueCell.numFmt = '0.0"%"'
    batchRow += 1
  }

  // 10 Low Attendance Students
  const lowSheet = createSheet(workbook, '10 Low Attendance Students', [
    { header: 'Student ID', key: 'code', width: 14 },
    { header: 'Student Name', key: 'name', width: 24 },
    { header: 'Batch', key: 'batch', width: 24 },
    { header: 'Attendance %', key: 'attendance', width: 13, style: { numFmt: '0.0"%"' } },
    { header: 'Absent', key: 'absent', width: 10 },
    { header: 'Late', key: 'late', width: 10 },
    { header: 'Excused', key: 'excused', width: 10 },
    { header: 'Risk', key: 'risk', width: 12 },
  ])
  for (const student of data.report.lowAttendance) {
    lowSheet.addRow({
      code: student.code,
      name: student.name,
      batch: student.batches.join(', '),
      attendance: student.attendance,
      absent: student.absent,
      late: student.late,
      excused: student.excused,
      risk: student.risk,
    })
  }
  finaliseSheet(lowSheet)

  // 11 Faculty Performance
  const facultyPerformanceSheet = createSheet(workbook, '11 Faculty Performance', [
    { header: 'Trainer', key: 'name', width: 24 },
    { header: 'Classes Conducted', key: 'sessions', width: 17 },
    { header: 'Students', key: 'students', width: 10 },
    { header: 'Attended Records', key: 'attended', width: 16 },
    { header: 'Eligible Records', key: 'eligible', width: 16 },
    { header: 'Attendance %', key: 'attendance', width: 13, style: { numFmt: '0.0"%"' } },
  ])
  for (const member of data.report.facultyStats) {
    facultyPerformanceSheet.addRow({
      name: member.name,
      sessions: member.sessions,
      students: member.students,
      attended: member.attended,
      eligible: member.eligible,
      attendance: member.attendance,
    })
  }
  finaliseSheet(facultyPerformanceSheet)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function buildStudentsWorkbook(data: WorkbookData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChessBishop Academy'
  workbook.created = new Date()

  const statsById = new Map(data.report.studentStats.map((stats) => [stats.id, stats]))

  const studentSheet = createSheet(workbook, 'Student Details', [
    { header: 'Student ID', key: 'code', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Date of Birth', key: 'dob', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Parent / Guardian', key: 'guardian', width: 24 },
    { header: 'Contact', key: 'contact', width: 18 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Level', key: 'level', width: 15 },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Batch', key: 'batch', width: 24 },
    { header: 'Trainer', key: 'trainer', width: 20 },
    { header: 'Joining Date', key: 'joined', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Attendance %', key: 'attendance', width: 13, style: { numFmt: '0.0"%"' } },
    { header: 'Risk', key: 'risk', width: 12 },
  ])

  for (const student of data.students) {
    const stats = statsById.get(student.id)
    studentSheet.addRow({
      code: student.studentCode,
      name: student.name,
      dob: student.dob,
      guardian: student.guardianName,
      contact: student.contact,
      email: student.email,
      level: student.level,
      status: student.status,
      batch: student.batches.map((batch) => `${batch.code} - ${batch.name}`).join('; '),
      trainer: data.batches.find((batch) => student.batches.some((item) => item.code === batch.code))?.trainerName ?? '—',
      joined: student.joiningDate,
      attendance: stats?.attendance ?? null,
      risk: stats?.risk ?? 'No Data',
    })
  }
  finaliseSheet(studentSheet)
  paintStatus(studentSheet, 'status')

  const historySheet = createSheet(workbook, 'Attendance History', [
    { header: 'Date', key: 'date', width: 15, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Student ID', key: 'studentCode', width: 14 },
    { header: 'Student Name', key: 'studentName', width: 24 },
    { header: 'Batch', key: 'batch', width: 26 },
    { header: 'Topic', key: 'topic', width: 26 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Remarks', key: 'remarks', width: 36 },
    { header: 'Trainer', key: 'trainer', width: 22 },
  ])
  for (const record of data.records) {
    historySheet.addRow({
      date: record.date,
      studentCode: record.studentCode,
      studentName: record.studentName,
      batch: `${record.batchCode} - ${record.batchName}`,
      topic: record.topicName ?? '—',
      status: record.status,
      remarks: record.remarks,
      trainer: record.trainerName,
    })
  }
  finaliseSheet(historySheet)
  paintStatus(historySheet, 'status')

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
