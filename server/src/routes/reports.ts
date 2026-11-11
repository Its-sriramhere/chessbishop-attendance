import { Router } from 'express'
import type { Request } from 'express'
import {
  buildAttendanceWorkbook,
  buildStudentsWorkbook,
  type AttendanceRecord,
  type BatchDetail,
  type FacultyDetail,
  type SessionDetail,
  type StudentDetail,
  type TopicDetail,
  type WorkbookData,
} from '../lib/excel'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { buildAttendanceReport } from '../services/attendance'
import { getScopedBatchIds } from '../services/scope'
import { asyncHandler } from '../utils/async-handler'
import { endOfDay, parseDateOnly, startOfDay } from '../utils/date'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)

function queryString(req: Request, key: string): string | null {
  return typeof req.query[key] === 'string' && req.query[key] ? (req.query[key] as string) : null
}

function dateStamp(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

function sendWorkbook(res: import('express').Response, buffer: Buffer, filename: string) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Length', String(buffer.length))
  res.send(buffer)
}

async function loadWorkbookData(req: Request): Promise<WorkbookData> {
  const user = req.user!
  const scope = await getScopedBatchIds(user)
  const batchId = queryString(req, 'batchId')
  const studentId = queryString(req, 'studentId') ?? undefined

  if (batchId && scope && !scope.includes(batchId)) {
    throw new HttpError(403, 'You can only export reports for your assigned batches')
  }

  const effectiveScope = batchId ? [batchId] : scope

  const fromDate = parseDateOnly(queryString(req, 'from'))
  const toDate = parseDateOnly(queryString(req, 'to'))
  const from = fromDate ? startOfDay(fromDate) : undefined
  const to = toDate ? endOfDay(toDate) : undefined

  if (studentId) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { batches: { select: { batchId: true } } },
    })
    if (!student) throw new HttpError(404, 'Student not found')
    if (effectiveScope && !student.batches.some((assignment) => effectiveScope.includes(assignment.batchId))) {
      throw new HttpError(403, 'You can only export students in your assigned batches')
    }
  }

  const report = await buildAttendanceReport({
    batchIds: effectiveScope,
    from,
    to,
    studentId,
  })

  const studentWhere = {
    ...(studentId ? { id: studentId } : {}),
    ...(effectiveScope ? { batches: { some: { batchId: { in: effectiveScope } } } } : {}),
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    include: {
      batches: {
        where: { endedAt: null },
        include: { batch: { select: { code: true, name: true } } },
      },
    },
    orderBy: { studentCode: 'asc' },
  })

  const batches = await prisma.batch.findMany({
    where: effectiveScope ? { id: { in: effectiveScope } } : {},
    include: {
      trainer: { select: { name: true } },
      students: { where: { endedAt: null }, select: { id: true } },
    },
    orderBy: { code: 'asc' },
  })

  const faculty = await prisma.faculty.findMany({
    where: user.role === 'ADMIN' ? {} : { id: user.facultyId ?? '__none__' },
    include: {
      batches: { select: { id: true } },
      sessions: { select: { id: true } },
    },
    orderBy: { employeeId: 'asc' },
  })

  const sessionWhere = {
    ...(effectiveScope ? { batchId: { in: effectiveScope } } : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  }

  const sessions = await prisma.classSession.findMany({
    where: sessionWhere,
    include: {
      batch: { select: { code: true, name: true } },
      trainer: { select: { name: true } },
      topic: { select: { name: true } },
      _count: { select: { attendance: true } },
    },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    take: 3000,
  })

  const records = await prisma.studentAttendance.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      session: sessionWhere,
    },
    include: {
      student: { select: { studentCode: true, name: true } },
      session: {
        include: {
          batch: { select: { code: true, name: true } },
          trainer: { select: { name: true } },
          topic: { select: { name: true, category: true } },
        },
      },
    },
    orderBy: { session: { date: 'desc' } },
    take: 20000,
  })

  const topics = await prisma.chessTopic.findMany({
    include: { _count: { select: { sessions: true } } },
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  })

  const studentDetails: StudentDetail[] = students.map((student) => ({
    id: student.id,
    studentCode: student.studentCode,
    name: student.name,
    dob: student.dob,
    guardianName: student.guardianName,
    contact: student.contact,
    email: student.email,
    level: student.level,
    joiningDate: student.joiningDate,
    status: student.status,
    batches: student.batches.map((assignment) => ({
      code: assignment.batch.code,
      name: assignment.batch.name,
    })),
  }))

  const batchDetails: BatchDetail[] = batches.map((batch) => ({
    code: batch.code,
    name: batch.name,
    level: batch.level,
    trainerName: batch.trainer?.name ?? null,
    daysLabel: batch.days
      .split(',')
      .filter(Boolean)
      .map((day) => day.charAt(0) + day.slice(1).toLowerCase())
      .join(', '),
    startTime: batch.startTime,
    endTime: batch.endTime,
    durationMin: batch.durationMin,
    studentCount: batch.students.length,
    isActive: batch.isActive,
  }))

  const facultyDetails: FacultyDetail[] = faculty.map((member) => ({
    employeeId: member.employeeId,
    name: member.name,
    email: member.email,
    phone: member.phone,
    joinedAt: member.joinedAt,
    batchCount: member.batches.length,
    sessionCount: member.sessions.length,
    isActive: member.isActive,
  }))

  const sessionDetails: SessionDetail[] = sessions.map((session) => ({
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    batchCode: session.batch.code,
    batchName: session.batch.name,
    trainerName: session.trainer.name,
    topicName: session.topic?.name ?? null,
    attendanceCount: session._count.attendance,
    description: session.description,
  }))

  const attendanceRecords: AttendanceRecord[] = records.map((record) => ({
    date: record.session.date,
    batchCode: record.session.batch.code,
    batchName: record.session.batch.name,
    studentCode: record.student.studentCode,
    studentName: record.student.name,
    status: record.status,
    remarks: record.remarks,
    trainerName: record.session.trainer.name,
    topicName: record.session.topic?.name ?? null,
    category: record.session.topic?.category ?? null,
  }))

  const topicDetails: TopicDetail[] = topics.map((topic) => ({
    code: topic.code,
    name: topic.name,
    category: topic.category,
    difficulty: topic.difficulty,
    estimatedMinutes: topic.estimatedMinutes,
    sessionCount: topic._count.sessions,
    description: topic.description,
  }))

  return {
    report,
    students: studentDetails,
    batches: batchDetails,
    faculty: facultyDetails,
    sessions: sessionDetails,
    records: attendanceRecords,
    topics: topicDetails,
    generatedBy: user.name,
  }
}

router.get(
  '/attendance.xlsx',
  asyncHandler(async (req, res) => {
    const data = await loadWorkbookData(req)
    const buffer = await buildAttendanceWorkbook(data)
    sendWorkbook(res, buffer, `chessbishop-attendance-${dateStamp()}.xlsx`)
  }),
)

router.get(
  '/students.xlsx',
  asyncHandler(async (req, res) => {
    const data = await loadWorkbookData(req)
    const buffer = await buildStudentsWorkbook(data)
    sendWorkbook(res, buffer, `chessbishop-students-${dateStamp()}.xlsx`)
  }),
)

export default router
