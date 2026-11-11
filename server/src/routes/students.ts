import { Level, Prisma, StudentStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { buildAttendanceReport } from '../services/attendance'
import { logAudit } from '../services/audit'
import { getScopedBatchIds } from '../services/scope'
import { asyncHandler } from '../utils/async-handler'
import { parseDateOnly } from '../utils/date'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)

const optionalText = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().max(200).nullable().optional(),
)

const optionalEmail = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().email('Enter a valid email address').nullable().optional(),
)

const studentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  dob: z.string().optional().nullable(),
  guardianName: optionalText,
  contact: optionalText,
  email: optionalEmail,
  level: z.nativeEnum(Level).optional(),
  joiningDate: z.string().optional().nullable(),
  status: z.nativeEnum(StudentStatus).optional(),
  batchId: z.string().nullable().optional(),
})

function serialiseStudent(student: {
  id: string
  studentCode: string
  name: string
  dob: Date | null
  guardianName: string | null
  contact: string | null
  email: string | null
  level: Level
  joiningDate: Date
  status: StudentStatus
  batches: {
    batchId: string
    endedAt: Date | null
    batch: { id: string; code: string; name: string; trainer?: { id: string; name: string } | null }
  }[]
}) {
  const active = student.batches.filter((assignment) => assignment.endedAt === null)
  return {
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
    batches: active.map((assignment) => ({
      id: assignment.batch.id,
      code: assignment.batch.code,
      name: assignment.batch.name,
      trainer: assignment.batch.trainer ?? null,
    })),
  }
}

async function nextStudentCode(): Promise<string> {
  const latest = await prisma.student.findFirst({
    orderBy: { studentCode: 'desc' },
    select: { studentCode: true },
  })
  const current = latest ? Number.parseInt(latest.studentCode.replace(/\D/g, ''), 10) || 0 : 0
  return `CHS-${String(current + 1).padStart(4, '0')}`
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = await getScopedBatchIds(req.user!)
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const batchId = typeof req.query.batchId === 'string' && req.query.batchId ? req.query.batchId : null
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))

    if (batchId && scope && !scope.includes(batchId)) {
      throw new HttpError(403, 'You can only view students in your assigned batches')
    }

    const where: Prisma.StudentWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
        { guardianName: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where.status = status as StudentStatus
    }

    if (batchId) {
      where.batches = { some: { batchId, endedAt: null } }
    } else if (scope) {
      where.batches = { some: { batchId: { in: scope }, endedAt: null } }
    }

    const effectiveScope = batchId ? [batchId] : scope
    const report = await buildAttendanceReport({ batchIds: effectiveScope })
    const statsById = new Map(report.studentStats.map((stats) => [stats.id, stats]))

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          batches: {
            where: { endedAt: null },
            include: { batch: { select: { id: true, code: true, name: true } } },
          },
        },
        orderBy: { studentCode: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    res.json({
      data: students.map((student) => {
        const stats = statsById.get(student.id)
        return {
          ...serialiseStudent(student),
          attendance: stats?.attendance ?? null,
          risk: stats?.risk ?? 'No Data',
          attended: stats?.attended ?? 0,
          absent: stats?.absent ?? 0,
          late: stats?.late ?? 0,
        }
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const scope = await getScopedBatchIds(req.user!)
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        batches: {
          include: {
            batch: {
              select: {
                id: true,
                code: true,
                name: true,
                level: true,
                trainer: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    })

    if (!student) {
      throw new HttpError(404, 'Student not found')
    }

    if (scope) {
      const allowed = student.batches.some((assignment) => scope.includes(assignment.batchId))
      if (!allowed) {
        throw new HttpError(403, 'You can only view students in your assigned batches')
      }
    }

    const report = await buildAttendanceReport({ batchIds: scope, studentId: student.id })
    const stats = report.studentStats[0] ?? null

    const history = await prisma.studentAttendance.findMany({
      where: { studentId: student.id },
      include: {
        session: {
          include: {
            batch: { select: { id: true, code: true, name: true } },
            topic: { select: { id: true, name: true, category: true } },
            trainer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { session: { date: 'desc' } },
      take: 200,
    })

    res.json({
      student: serialiseStudent(student),
      stats,
      batches: student.batches.map((assignment) => ({
        id: assignment.batch.id,
        code: assignment.batch.code,
        name: assignment.batch.name,
        level: assignment.batch.level,
        trainer: assignment.batch.trainer,
        assignedAt: assignment.assignedAt,
        endedAt: assignment.endedAt,
      })),
      history: history.map((record) => ({
        id: record.id,
        date: record.session.date,
        sessionId: record.sessionId,
        batch: record.session.batch,
        topic: record.session.topic,
        trainer: record.session.trainer,
        status: record.status,
        remarks: record.remarks,
      })),
    })
  }),
)

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = studentSchema.parse(req.body)
    const joiningDate = parseDateOnly(input.joiningDate) ?? new Date()
    const dob = parseDateOnly(input.dob) ?? null

    let batch: { id: string } | null = null
    if (input.batchId) {
      batch = await prisma.batch.findUnique({ where: { id: input.batchId }, select: { id: true } })
      if (!batch) throw new HttpError(404, 'Batch not found')
    }

    const student = await prisma.student.create({
      data: {
        studentCode: await nextStudentCode(),
        name: input.name,
        dob,
        guardianName: input.guardianName ?? null,
        contact: input.contact ?? null,
        email: input.email ?? null,
        level: input.level ?? Level.BEGINNER,
        joiningDate,
        status: input.status ?? StudentStatus.ACTIVE,
      },
    })

    if (batch) {
      await prisma.batchStudent.create({
        data: { studentId: student.id, batchId: batch.id, assignedAt: joiningDate },
      })
    }

    await logAudit(req.user!.id, 'STUDENT_CREATED', 'Student', student.id, undefined, {
      studentCode: student.studentCode,
      name: student.name,
      batchId: batch?.id ?? null,
    })

    res.status(201).json({ student })
  }),
)

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = studentSchema.partial().parse(req.body)
    const existing = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { batches: { where: { endedAt: null } } },
    })
    if (!existing) throw new HttpError(404, 'Student not found')

    const data: Prisma.StudentUpdateInput = {}
    if (input.name !== undefined) data.name = input.name
    if (input.guardianName !== undefined) data.guardianName = input.guardianName
    if (input.contact !== undefined) data.contact = input.contact
    if (input.email !== undefined) data.email = input.email
    if (input.level !== undefined) data.level = input.level
    if (input.status !== undefined) data.status = input.status
    if (input.dob !== undefined) {
      const dob = parseDateOnly(input.dob)
      if (dob !== undefined) data.dob = dob
    }
    if (input.joiningDate !== undefined) {
      const joiningDate = parseDateOnly(input.joiningDate)
      if (joiningDate) data.joiningDate = joiningDate
    }

    if (input.batchId !== undefined) {
      if (input.batchId) {
        const batch = await prisma.batch.findUnique({
          where: { id: input.batchId },
          select: { id: true },
        })
        if (!batch) throw new HttpError(404, 'Batch not found')
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const student = await tx.student.update({ where: { id: existing.id }, data })

      if (input.batchId !== undefined) {
        const now = new Date()
        await tx.batchStudent.updateMany({
          where: {
            studentId: existing.id,
            endedAt: null,
            ...(input.batchId ? { batchId: { not: input.batchId } } : {}),
          },
          data: { endedAt: now },
        })

        if (input.batchId) {
          const alreadyAssigned = await tx.batchStudent.findFirst({
            where: { studentId: existing.id, batchId: input.batchId, endedAt: null },
          })
          if (!alreadyAssigned) {
            await tx.batchStudent.create({
              data: { studentId: existing.id, batchId: input.batchId, assignedAt: now },
            })
          }
        }
      }

      return student
    })

    await logAudit(req.user!.id, 'STUDENT_UPDATED', 'Student', updated.id, {
      name: existing.name,
      status: existing.status,
      batches: existing.batches.map((assignment) => assignment.batchId),
    }, {
      name: updated.name,
      status: updated.status,
      batchId: input.batchId ?? null,
    })

    res.json({ student: updated })
  }),
)

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.student.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Student not found')

    await prisma.$transaction([
      prisma.student.update({ where: { id: existing.id }, data: { status: 'INACTIVE' } }),
      prisma.batchStudent.updateMany({
        where: { studentId: existing.id, endedAt: null },
        data: { endedAt: new Date() },
      }),
    ])

    await logAudit(req.user!.id, 'STUDENT_DEACTIVATED', 'Student', existing.id, {
      status: existing.status,
    }, { status: 'INACTIVE' })

    res.json({ success: true })
  }),
)

export default router
