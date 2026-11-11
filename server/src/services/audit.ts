import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

export async function logAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
    },
  })
}
