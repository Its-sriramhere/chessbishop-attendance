import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../utils/http-error'

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' })
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.flatten().fieldErrors,
    })
    return
  }

  if (typeof error === 'object' && error !== null && 'type' in error) {
    const type = (error as { type?: string }).type
    if (type === 'entity.too.large') {
      res.status(413).json({ error: 'The workbook is larger than 10 MB. Split it into smaller files.' })
      return
    }
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code
    if (code === 'P2002') {
      res.status(409).json({ error: 'A record with these unique details already exists' })
      return
    }
    if (code === 'P2025') {
      res.status(404).json({ error: 'Record not found' })
      return
    }
  }

  console.error('[server] Unhandled error:', error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
