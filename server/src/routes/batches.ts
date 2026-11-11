import { Level, Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { logAudit } from '../services/audit'
import { getScopedBatchIds } from '../services/scope'
import { asyncHandler } from '../utils/async-handler'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)

const DAY_SET = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const daysSchema = z.union([z.array(z.string()), z.string()])

function normaliseDays(value: string[] | string): string {
  const parts = Array.isArray(value) ? value : value.split(',')
  const days = parts.map((day) => day.trim().toUpperCase()).filter(Boolean)
  if (days.length === 0) throw new HttpError(400, 'Select at least one class day')
  for (const day of days) {
    if (!DAY_SET.has(day)) throw new HttpError(400, `Invalid class day: ${day}`)
  }
  return Array.from(new Set(days)).join(',')
}

function minutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return Math.max(15, eh * 60 + em - (sh * 60 + sm))
}

const batchSchema = z.object({
  code: z.string().trim().min(2).max(20).optional(),
  name: z.string().trim().min(2).max(120),
  level: z.nativeEnum(Level).optional(),
  days: daysSchema,
  startTime: z.string().regex(TIME_REGEX, 'Use HH:MM format'),
  endTime: z.string().regex(TIME_REGEX, 'Use HH:MM format'),
  durationMin: z.coerce.number().int().min(15).max(300).optional(),
  trainerId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

async function nextBatchCode(): Promise<string> {
  const count = await prisma.batch.count()
  return `CH-B${String(count + 1).padStart(2, '0')}`
}

function serialiseBatch(batch: {
  id: string
  code: string
  name: string
  level: Level
  days: string
  startTime: string
  endTime: string
  durationMin: number
  isActive: boolean
  trainer: { id: string; name: string } | null
  students: { id: string }[]
  sessions: { id: string }[]
}) {
  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    level: batch.level,
    days: batch.days.split(',').filter(Boolean),
    daysLabel: batch.days
      .split(',')
      .filter(Boolean)
      .map((day) => day.charAt(0) + day.slice(1).toLowerCase())
      .join(', '),
    startTime: batch.startTime,
    endTime: batch.endTime,
    durationMin: batch.durationMin,
    isActive: batch.isActive,
    trainer: batch.trainer,
    studentCount: batch.students.length,
    sessionCount: batch.sessions.length,
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = await getScopedBatchIds(req.user!)
    const where: Prisma.BatchWhereInput = scope ? { id: { in: scope } } : {}

    const batches = await prisma.batch.findMany({
      where,
      include: {
        trainer: { select: { id: true, name: true } },
        students: { where: { endedAt: null }, select: { id: true } },
        sessions: { select: { id: true } },
      },
      orderBy: { code: 'asc' },
    })

    res.json({ data: batches.map(serialiseBatch) })
  }),
)

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = batchSchema.parse(req.body)

    if (input.trainerId) {
      const trainer = await prisma.faculty.findUnique({ where: { id: input.trainerId } })
      if (!trainer) throw new HttpError(404, 'Trainer not found')
    }

    const batch = await prisma.batch.create({
      data: {
        code: input.code || (await nextBatchCode()),
        name: input.name,
        level: input.level ?? Level.BEGINNER,
        days: normaliseDays(input.days),
        startTime: input.startTime,
        endTime: input.endTime,
        durationMin: input.durationMin ?? minutesBetween(input.startTime, input.endTime),
        trainerId: input.trainerId ?? null,
        isActive: input.isActive ?? true,
      },
    })

    await logAudit(req.user!.id, 'BATCH_CREATED', 'Batch', batch.id, undefined, {
      code: batch.code,
      name: batch.name,
    })

    res.status(201).json({ batch })
  }),
)

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = batchSchema.partial().parse(req.body)
    const existing = await prisma.batch.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Batch not found')

    if (input.trainerId) {
      const trainer = await prisma.faculty.findUnique({ where: { id: input.trainerId } })
      if (!trainer) throw new HttpError(404, 'Trainer not found')
    }

    const data: Prisma.BatchUpdateInput = {}
    if (input.code !== undefined) data.code = input.code
    if (input.name !== undefined) data.name = input.name
    if (input.level !== undefined) data.level = input.level
    if (input.days !== undefined) data.days = normaliseDays(input.days)
    if (input.startTime !== undefined) data.startTime = input.startTime
    if (input.endTime !== undefined) data.endTime = input.endTime
    if (input.durationMin !== undefined) data.durationMin = input.durationMin
    if (input.isActive !== undefined) data.isActive = input.isActive
    if (input.trainerId !== undefined) {
      data.trainer = input.trainerId ? { connect: { id: input.trainerId } } : { disconnect: true }
    }

    const batch = await prisma.batch.update({ where: { id: existing.id }, data })

    await logAudit(req.user!.id, 'BATCH_UPDATED', 'Batch', batch.id, {
      name: existing.name,
      trainerId: existing.trainerId,
    }, {
      name: batch.name,
      trainerId: batch.trainerId,
    })

    res.json({ batch })
  }),
)

router.get(
  '/:id/students',
  asyncHandler(async (req, res) => {
    const scope = await getScopedBatchIds(req.user!)
    if (scope && !scope.includes(req.params.id)) {
      throw new HttpError(403, 'You can only view your assigned batches')
    }

    const assignments = await prisma.batchStudent.findMany({
      where: { batchId: req.params.id, endedAt: null },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            name: true,
            level: true,
            status: true,
            contact: true,
          },
        },
      },
      orderBy: { student: { studentCode: 'asc' } },
    })

    res.json({ data: assignments.map((assignment) => assignment.student) })
  }),
)

export default router
