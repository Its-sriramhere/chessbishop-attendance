import express, { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import {
  analyseAttendanceImport,
  buildAttendanceImportTemplate,
  commitAttendanceImport,
  type ImportPreview,
} from '../services/attendance-import'
import { asyncHandler } from '../utils/async-handler'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)
router.use(requireRole('ADMIN'))

const rawXlsx = express.raw({ type: () => true, limit: '10mb' })

function worksheetBuffer(req: express.Request): Buffer {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(400, 'Choose an Excel file to upload.')
  }
  return req.body
}

function fileName(req: express.Request): string {
  const header = req.header('x-file-name')
  if (!header) return 'attendance-import.xlsx'
  try {
    return decodeURIComponent(header).slice(0, 180)
  } catch {
    return 'attendance-import.xlsx'
  }
}

function queryString(req: express.Request, key: string): string | undefined {
  const value = req.query[key]
  return typeof value === 'string' && value ? value : undefined
}

router.get(
  '/template.xlsx',
  asyncHandler(async (req, res) => {
    const { buffer, filename } = await buildAttendanceImportTemplate({
      from: queryString(req, 'from'),
      to: queryString(req, 'to'),
      batchId: queryString(req, 'batchId') ?? null,
    })
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.send(buffer)
  }),
)

router.post(
  '/preview',
  rawXlsx,
  asyncHandler(async (req, res) => {
    const analysis = await analyseAttendanceImport(worksheetBuffer(req))
    const preview: ImportPreview = {
      summary: analysis.summary,
      sessions: analysis.sessions,
      issues: analysis.issues,
    }
    res.json(preview)
  }),
)

router.post(
  '/commit',
  rawXlsx,
  asyncHandler(async (req, res) => {
    const analysis = await analyseAttendanceImport(worksheetBuffer(req))
    if (analysis.errors > 0) {
      res.status(400).json({
        error: `Fix ${analysis.errors} validation ${analysis.errors === 1 ? 'error' : 'errors'} before importing this workbook.`,
        issues: analysis.issues,
        summary: analysis.summary,
      })
      return
    }

    const result = await commitAttendanceImport(analysis, req.user!.id, fileName(req))
    res.json(result)
  }),
)

export default router
