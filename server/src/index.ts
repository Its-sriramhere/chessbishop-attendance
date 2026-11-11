import app from './app'
import { config } from './config'
import { prisma } from './lib/prisma'

const server = app.listen(config.port, () => {
  console.log(`[api] ChessBishop attendance API listening on http://localhost:${config.port}`)
})

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
