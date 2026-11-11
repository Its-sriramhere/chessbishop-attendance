import type { Role } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null
    const token = req.cookies?.token || bearer

    if (!token) {
      throw new HttpError(401, 'Authentication required')
    }

    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & { sub?: string }
    if (!payload.sub) {
      throw new HttpError(401, 'Invalid session')
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, facultyId: true, isActive: true },
    })

    if (!user || !user.isActive) {
      throw new HttpError(401, 'Account is inactive or no longer exists')
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      facultyId: user.facultyId,
    }
    next()
  } catch (error) {
    if (error instanceof HttpError) {
      next(error)
      return
    }
    next(new HttpError(401, 'Invalid or expired session'))
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new HttpError(401, 'Authentication required'))
      return
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'You do not have permission to perform this action'))
      return
    }
    next()
  }
}
