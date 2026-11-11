import { Level, Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { logAudit } from '../services/audit'
import { asyncHandler } from '../utils/async-handler'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)

const topicSchema = z.object({
  code: z.string().trim().min(2).max(20).optional(),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  difficulty: z.nativeEnum(Level).optional(),
  description: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(2000).nullable().optional(),
  ),
  objectives: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(2000).nullable().optional(),
  ),
  estimatedMinutes: z.coerce.number().int().min(5).max(600).nullable().optional(),
  parentId: z.string().nullable().optional(),
})

async function nextTopicCode(): Promise<string> {
  const count = await prisma.chessTopic.count()
  return `TOP-${String(count + 1).padStart(3, '0')}`
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const topics = await prisma.chessTopic.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { sessions: true, children: true } },
      },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    })

    res.json({
      data: topics.map((topic) => ({
        id: topic.id,
        code: topic.code,
        name: topic.name,
        category: topic.category,
        difficulty: topic.difficulty,
        description: topic.description,
        objectives: topic.objectives,
        estimatedMinutes: topic.estimatedMinutes,
        parent: topic.parent,
        sessionCount: topic._count.sessions,
        childCount: topic._count.children,
      })),
    })
  }),
)

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = topicSchema.parse(req.body)

    if (input.parentId) {
      const parent = await prisma.chessTopic.findUnique({ where: { id: input.parentId } })
      if (!parent) throw new HttpError(404, 'Parent topic not found')
    }

    const topic = await prisma.chessTopic.create({
      data: {
        code: input.code || (await nextTopicCode()),
        name: input.name,
        category: input.category,
        difficulty: input.difficulty ?? Level.BEGINNER,
        description: input.description ?? null,
        objectives: input.objectives ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        parentId: input.parentId ?? null,
      },
    })

    await logAudit(req.user!.id, 'TOPIC_CREATED', 'ChessTopic', topic.id, undefined, {
      code: topic.code,
      name: topic.name,
      category: topic.category,
    })

    res.status(201).json({ topic })
  }),
)

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = topicSchema.partial().parse(req.body)
    const existing = await prisma.chessTopic.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Topic not found')

    if (input.parentId) {
      if (input.parentId === existing.id) throw new HttpError(400, 'A topic cannot be its own parent')
      const parent = await prisma.chessTopic.findUnique({ where: { id: input.parentId } })
      if (!parent) throw new HttpError(404, 'Parent topic not found')
    }

    const data: Prisma.ChessTopicUpdateInput = {}
    if (input.code !== undefined) data.code = input.code
    if (input.name !== undefined) data.name = input.name
    if (input.category !== undefined) data.category = input.category
    if (input.difficulty !== undefined) data.difficulty = input.difficulty
    if (input.description !== undefined) data.description = input.description
    if (input.objectives !== undefined) data.objectives = input.objectives
    if (input.estimatedMinutes !== undefined) data.estimatedMinutes = input.estimatedMinutes
    if (input.parentId !== undefined) {
      data.parent = input.parentId ? { connect: { id: input.parentId } } : { disconnect: true }
    }

    const topic = await prisma.chessTopic.update({ where: { id: existing.id }, data })

    await logAudit(req.user!.id, 'TOPIC_UPDATED', 'ChessTopic', topic.id, {
      name: existing.name,
    }, {
      name: topic.name,
    })

    res.json({ topic })
  }),
)

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.chessTopic.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { sessions: true, children: true } } },
    })
    if (!existing) throw new HttpError(404, 'Topic not found')
    if (existing._count.sessions > 0) {
      throw new HttpError(400, 'This topic is used by class sessions and cannot be deleted')
    }
    if (existing._count.children > 0) {
      throw new HttpError(400, 'Remove subtopics before deleting this topic')
    }

    await prisma.chessTopic.delete({ where: { id: existing.id } })
    await logAudit(req.user!.id, 'TOPIC_DELETED', 'ChessTopic', existing.id, {
      code: existing.code,
      name: existing.name,
    })

    res.json({ success: true })
  }),
)

export default router
