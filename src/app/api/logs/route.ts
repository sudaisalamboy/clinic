import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)
  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const counts = await db.note.count() 
  const linkCount = await db.link.count()
  const sessionCount = await db.session.count({
    where: { expiresAt: { gt: new Date() } },
  })
  return NextResponse.json({
    logs,
    stats: {
      notes: counts,
      links: linkCount,
      activeSessions: sessionCount,
    },
  })
}
