import { AttendanceStatus, Prisma, SessionStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { logAudit } from '../services/audit'
import { assertBatchAccess, getScopedBatchIds } from '../services/scope'
import { asyncHandler } from '../utils/async-handler'
import { parseDateOnly } from '../utils/date'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const sessionSchema = z.object({
  batchId: z.string().min(1),
  trainerId: z.string().optional(),
  date: z.string().min(1, 'Select a date'),
  startTime: z.string().regex(TIME_REGEX, 'Use HH:MM format'),
  endTime: z.string().regex(TIME_REGEX, 'Use HH:MM format'),
  topicId: z.preprocess((value) => (value === '' ? null : value), z.string().nullable().optional()),
  subtopicId: z.preprocess((value) => (value === '' ? null : value), z.string().nullable().optional()),
  description: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(2000).nullable().optional(),
  ),
  objectives: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(2000).nullable().optional(),
  ),
  status: z.nativeEnum(SessionStatus).optional(),
})

const attendanceSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.nativeEnum(AttendanceStatus),
        remarks: z.preprocess(
          (value) => (value === '' ? null : value),
          z.string().trim().max(500).nullable().optional(),
        ),
      }),
    )
    .min(1, 'Provide attendance for at least one student'),
  status: z.nativeEnum(SessionStatus).optional(),
})

function serialiseSession(session: {
  id: string
  batchId: string
  trainerId: string
  topicId: string | null
  subtopicId: string | null
  date: Date
  startTime: string
  endTime: string
  description: string | null
  objectives: string | null
  status: SessionStatus
  batch: { id: string; code: string; name: string }
  trainer: { id: string; name: string }
  topic: { id: string; name: string; category: string } | null
  subtopic: { id: string; name: string } | null
  _count?: { attendance: number }
}) {
  return {
    id: session.id,
    batchId: session.batchId,
    trainerId: session.trainerId,
    topicId: session.topicId,
    subtopicId: session.subtopicId,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    description: session.description,
    objectives: session.objectives,
    status: session.status,
    batch: session.batch,
    trainer: session.trainer,
    topic: session.topic,
    subtopic: session.subtopic,
    attendanceCount: session._count?.attendance ?? 0,
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = await getScopedBatchIds(req.user!)
    const batchId = typeof req.query.batchId === 'string' && req.query.batchId ? req.query.batchId : null
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null
    const from = parseDateOnly(typeof req.query.from === 'string' ? req.query.from : null)
    const to = parseDateOnly(typeof req.query.to === 'string' ? req.query.to : null)

    if (batchId && scope && !scope.includes(batchId)) {
      throw new HttpError(403, 'You can only view your assigned batches')
    }

    const where: Prisma.ClassSessionWhereInput = {}
    if (batchId) where.batchId = batchId
    else if (scope) where.batchId = { in: scope }
    if (status && Object.values(SessionStatus).includes(status as SessionStatus)) {
      where.status = status as SessionStatus
    }
    if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      }
    }

    const sessions = await prisma.classSession.findMany({
      where,
      include: {
        batch: { select: { id: true, code: true, name: true } },
        trainer: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true, category: true } },
        subtopic: { select: { id: true, name: true } },
        _count: { select: { attendance: true } },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      take: 400,
    })

    res.json({ data: sessions.map(serialiseSession) })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = await prisma.classSession.findUnique({
      where: { id: req.params.id },
      include: {
        batch: { select: { id: true, code: true, name: true } },
        trainer: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true, category: true } },
        subtopic: { select: { id: true, name: true } },
        attendance: {
          include: {
            student: { select: { id: true, studentCode: true, name: true } },
          },
        },
      },
    })

    if (!session) throw new HttpError(404, 'Class session not found')

    const scope = await getScopedBatchIds(req.user!)
    if (scope && !scope.includes(session.batchId)) {
      throw new HttpError(403, 'You can only view your assigned batches')
    }

    const roster = await prisma.batchStudent.findMany({
      where: { batchId: session.batchId, endedAt: null },
      include: {
        student: { select: { id: true, studentCode: true, name: true, level: true, status: true } },
      },
      orderBy: { student: { studentCode: 'asc' } },
    })

    const settings = await prisma.academySetting.findUnique({ where: { id: 'singleton' } })
    const attendanceByStudent = new Map(
      session.attendance.map((record) => [record.studentId, record]),
    )

    res.json({
      session: serialiseSession(session),
      roster: roster
        .filter((assignment) => assignment.student.status !== 'INACTIVE' || attendanceByStudent.has(assignment.student.id))
        .map((assignment) => {
          const record = attendanceByStudent.get(assignment.student.id)
          return {
            student: assignment.student,
            attendance: record
              ? {
                  id: record.id,
                  status: record.status,
                  remarks: record.remarks,
                  markedAt: record.markedAt,
                }
              : null,
          }
        }),
      policy: settings,
    })
  }),
)

router.post(
  '/',
  requireRole('ADMIN', 'FACULTY'),
  asyncHandler(async (req, res) => {
    const input = sessionSchema.parse(req.body)
    await assertBatchAccess(req.user!, input.batchId)

    const batch = await prisma.batch.findUnique({
      where: { id: input.batchId },
      select: { id: true, trainerId: true },
    })
    if (!batch) throw new HttpError(404, 'Batch not found')

    const trainerId = input.trainerId ?? batch.trainerId
    if (!trainerId) throw new HttpError(400, 'Assign a trainer to this batch first')
    if (req.user!.role === 'FACULTY' && trainerId !== req.user!.facultyId) {
      throw new HttpError(403, 'You can only schedule classes for yourself')
    }
    const trainer = await prisma.faculty.findUnique({ where: { id: trainerId } })
    if (!trainer) throw new HttpError(404, 'Trainer not found')

    const date = parseDateOnly(input.date)
    if (!date) throw new HttpError(400, 'Enter a valid class date')

    if (input.topicId) {
      const topic = await prisma.chessTopic.findUnique({ where: { id: input.topicId } })
      if (!topic) throw new HttpError(404, 'Topic not found')
    }
    if (input.subtopicId) {
      const subtopic = await prisma.chessTopic.findUnique({ where: { id: input.subtopicId } })
      if (!subtopic) throw new HttpError(404, 'Subtopic not found')
    }

    const session = await prisma.classSession.create({
      data: {
        batchId: input.batchId,
        trainerId,
        topicId: input.topicId ?? null,
        subtopicId: input.subtopicId ?? null,
        date,
        startTime: input.startTime,
        endTime: input.endTime,
        description: input.description ?? null,
        objectives: input.objectives ?? null,
        status: input.status ?? SessionStatus.SCHEDULED,
      },
    })

    await logAudit(req.user!.id, 'SESSION_CREATED', 'ClassSession', session.id, undefined, {
      batchId: session.batchId,
      date: session.date,
      topicId: session.topicId,
      status: session.status,
    })

    res.status(201).json({ session })
  }),
)

router.patch(
  '/:id',
  requireRole('ADMIN', 'FACULTY'),
  asyncHandler(async (req, res) => {
    const input = sessionSchema.partial().parse(req.body)
    const existing = await prisma.classSession.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Class session not found')

    await assertBatchAccess(req.user!, existing.batchId)
    if (input.batchId && input.batchId !== existing.batchId) {
      await assertBatchAccess(req.user!, input.batchId)
    }

    if (input.topicId) {
      const topic = await prisma.chessTopic.findUnique({ where: { id: input.topicId } })
      if (!topic) throw new HttpError(404, 'Topic not found')
    }
    if (input.subtopicId) {
      const subtopic = await prisma.chessTopic.findUnique({ where: { id: input.subtopicId } })
      if (!subtopic) throw new HttpError(404, 'Subtopic not found')
    }
    if (input.trainerId) {
      const trainer = await prisma.faculty.findUnique({ where: { id: input.trainerId } })
      if (!trainer) throw new HttpError(404, 'Trainer not found')
      if (req.user!.role === 'FACULTY' && input.trainerId !== req.user!.facultyId) {
        throw new HttpError(403, 'You can only assign classes to yourself')
      }
    }

    const data: Prisma.ClassSessionUpdateInput = {}
    if (input.batchId !== undefined) data.batch = { connect: { id: input.batchId } }
    if (input.trainerId !== undefined) data.trainer = { connect: { id: input.trainerId } }
    if (input.date !== undefined) {
      const date = parseDateOnly(input.date)
      if (!date) throw new HttpError(400, 'Enter a valid class date')
      data.date = date
    }
    if (input.startTime !== undefined) data.startTime = input.startTime
    if (input.endTime !== undefined) data.endTime = input.endTime
    if (input.description !== undefined) data.description = input.description
    if (input.objectives !== undefined) data.objectives = input.objectives
    if (input.status !== undefined) data.status = input.status
    if (input.topicId !== undefined) {
      data.topic = input.topicId ? { connect: { id: input.topicId } } : { disconnect: true }
    }
    if (input.subtopicId !== undefined) {
      data.subtopic = input.subtopicId ? { connect: { id: input.subtopicId } } : { disconnect: true }
    }

    const session = await prisma.classSession.update({ where: { id: existing.id }, data })

    await logAudit(req.user!.id, 'SESSION_UPDATED', 'ClassSession', session.id, {
      date: existing.date,
      status: existing.status,
      topicId: existing.topicId,
    }, {
      date: session.date,
      status: session.status,
      topicId: session.topicId,
    })

    res.json({ session })
  }),
)

router.put(
  '/:id/attendance',
  requireRole('ADMIN', 'FACULTY'),
  asyncHandler(async (req, res) => {
    const input = attendanceSchema.parse(req.body)
    const session = await prisma.classSession.findUnique({
      where: { id: req.params.id },
      include: { attendance: true },
    })
    if (!session) throw new HttpError(404, 'Class session not found')

    await assertBatchAccess(req.user!, session.batchId)
    if (session.status === SessionStatus.CANCELLED) {
      throw new HttpError(400, 'Attendance cannot be recorded for a cancelled class')
    }

    const roster = await prisma.batchStudent.findMany({
      where: { batchId: session.batchId, endedAt: null },
      select: { studentId: true },
    })
    const rosterIds = new Set(roster.map((assignment) => assignment.studentId))

    const unique = new Map<string, { studentId: string; status: AttendanceStatus; remarks: string | null }>()
    for (const record of input.records) {
      if (!rosterIds.has(record.studentId)) {
        throw new HttpError(400, 'One or more students are not part of this batch')
      }
      unique.set(record.studentId, {
        studentId: record.studentId,
        status: record.status,
        remarks: record.remarks ?? null,
      })
    }

    const before = session.attendance.map((record) => ({
      studentId: record.studentId,
      status: record.status,
    }))

    await prisma.$transaction(async (tx) => {
      for (const record of unique.values()) {
        await tx.studentAttendance.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: record.studentId,
            },
          },
          create: {
            sessionId: session.id,
            studentId: record.studentId,
            status: record.status,
            remarks: record.remarks,
            markedById: req.user!.id,
          },
          update: {
            status: record.status,
            remarks: record.remarks,
            markedById: req.user!.id,
          },
        })
      }

      if (input.status && input.status !== session.status) {
        await tx.classSession.update({ where: { id: session.id }, data: { status: input.status } })
      }
    })

    await logAudit(req.user!.id, 'ATTENDANCE_SAVED', 'StudentAttendance', session.id, { records: before }, {
      records: Array.from(unique.values()),
      sessionStatus: input.status ?? session.status,
    })

    const saved = await prisma.studentAttendance.findMany({
      where: { sessionId: session.id },
      include: { student: { select: { id: true, studentCode: true, name: true } } },
    })

    res.json({ data: saved })
  }),
)

export default router
