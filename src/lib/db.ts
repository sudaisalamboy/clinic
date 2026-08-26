import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In dev, on every HMR reload of this module, disconnect the previously
// cached PrismaClient and create a fresh one. This makes the dev server
// pick up schema changes (e.g. after `bun run db:push`) WITHOUT needing
// a full dev-server restart. The disconnect is fire-and-forget — it
// closes the old SQLite file handle asynchronously while the new client
// connects to the current `db/custom.db`.
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  globalForPrisma.prisma
    .$disconnect()
    .catch(() => {})
  globalForPrisma.prisma = undefined
}

// Only log queries in development — NEVER in production. Unconditional
// `log: ['query']` would stream every SQL statement (including parameter
// values) to stdout in prod, which is both a performance cost and a data
// exposure risk. In prod we keep a minimal `warn`+`error` surface.
const isDev = process.env.NODE_ENV !== 'production'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (isDev) globalForPrisma.prisma = db
