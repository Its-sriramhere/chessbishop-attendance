import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { logAudit } from '../services/audit'
import { asyncHandler } from '../utils/async-handler'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)

const facultySchema = z.object({
  employeeId: z.string().trim().min(2).max(20).optional(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(40).nullable().optional(),
  ),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  isActive: z.boolean().optional(),
})

function serialiseFaculty(faculty: {
  id: string
  employeeId: string
  name: string
  email: string
  phone: string | null
  joinedAt: Date
  isActive: boolean
  user: { id: string; email: string; isActive: boolean } | null
  batches: { id: string }[]
  sessions: { id: string }[]
}) {
  return {
    id: faculty.id,
    employeeId: faculty.employeeId,
    name: faculty.name,
    email: faculty.email,
    phone: faculty.phone,
    joinedAt: faculty.joinedAt,
    isActive: faculty.isActive,
    hasLogin: Boolean(faculty.user),
    loginEmail: faculty.user?.email ?? null,
    batchCount: faculty.batches.length,
    sessionCount: faculty.sessions.length,
  }
}

async function nextEmployeeId(): Promise<string> {
  const count = await prisma.faculty.count()
  return `FAC-${String(count + 1).padStart(3, '0')}`
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const faculty = await prisma.faculty.findMany({
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        batches: { select: { id: true } },
        sessions: { select: { id: true } },
      },
      orderBy: { employeeId: 'asc' },
    })

    res.json({ data: faculty.map(serialiseFaculty) })
  }),
)

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = facultySchema.parse(req.body)
    const email = input.email.toLowerCase()

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) throw new HttpError(409, 'A login already exists for this email')

    const faculty = await prisma.$transaction(async (tx) => {
      const created = await tx.faculty.create({
        data: {
          employeeId: input.employeeId || (await nextEmployeeId()),
          name: input.name,
          email,
          phone: input.phone ?? null,
          isActive: input.isActive ?? true,
        },
      })

      const passwordHash = await bcrypt.hash(input.password || 'Coach@123', 10)
      await tx.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          role: 'FACULTY',
          facultyId: created.id,
        },
      })

      return created
    })

    await logAudit(req.user!.id, 'FACULTY_CREATED', 'Faculty', faculty.id, undefined, {
      employeeId: faculty.employeeId,
      name: faculty.name,
      email: faculty.email,
    })

    res.status(201).json({ faculty })
  }),
)

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = facultySchema.partial().parse(req.body)
    const existing = await prisma.faculty.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    })
    if (!existing) throw new HttpError(404, 'Faculty not found')

    const email = input.email?.toLowerCase()
    if (email && email !== existing.email && !existing.user) {
      const conflict = await prisma.user.findUnique({ where: { email } })
      if (conflict) throw new HttpError(409, 'A login already exists for this email')
    }

    const data: Prisma.FacultyUpdateInput = {}
    if (input.employeeId !== undefined) data.employeeId = input.employeeId
    if (input.name !== undefined) data.name = input.name
    if (email !== undefined) data.email = email
    if (input.phone !== undefined) data.phone = input.phone
    if (input.isActive !== undefined) data.isActive = input.isActive

    const faculty = await prisma.$transaction(async (tx) => {
      const updated = await tx.faculty.update({ where: { id: existing.id }, data })

      if (existing.user) {
        const userData: Prisma.UserUpdateInput = {}
        if (input.name !== undefined) userData.name = input.name
        if (email !== undefined) userData.email = email
        if (input.isActive !== undefined) userData.isActive = input.isActive
        if (input.password) userData.passwordHash = await bcrypt.hash(input.password, 10)
        if (Object.keys(userData).length > 0) {
          await tx.user.update({ where: { id: existing.user.id }, data: userData })
        }
      }

      return updated
    })

    await logAudit(req.user!.id, 'FACULTY_UPDATED', 'Faculty', faculty.id, {
      name: existing.name,
      email: existing.email,
      isActive: existing.isActive,
    }, {
      name: faculty.name,
      email: faculty.email,
      isActive: faculty.isActive,
    })

    res.json({ faculty })
  }),
)

export default router
