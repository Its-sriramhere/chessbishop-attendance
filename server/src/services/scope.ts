import type { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

interface SessionUser {
  id: string
  role: Role
  facultyId: string | null
}

export async function getScopedBatchIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === 'ADMIN') return null
  if (!user.facultyId) return []
  const batches = await prisma.batch.findMany({
    where: { trainerId: user.facultyId },
    select: { id: true },
  })
  return batches.map((batch) => batch.id)
}

export async function assertBatchAccess(user: SessionUser, batchId: string): Promise<void> {
  if (user.role === 'ADMIN') return
  if (!user.facultyId) {
    throw new HttpError(403, 'Your account is not linked to a faculty profile')
  }
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { trainerId: true },
  })
  if (!batch) {
    throw new HttpError(404, 'Batch not found')
  }
  if (batch.trainerId !== user.facultyId) {
    throw new HttpError(403, 'You can only manage your assigned batches')
  }
}
