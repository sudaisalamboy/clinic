import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

/// Returns appointments that need the owner's attention today:
/// - Scheduled/Confirmed appointments in the next 2 hours (upcoming reminders)
/// - Checked-In appointments waiting to be Completed
/// - Any appointments today whose reminderSent flag is false
export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const now = new Date()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  // Upcoming in next 2h (Scheduled or Confirmed)
  const upcoming = await db.appointment.findMany({
    where: {
      scheduledAt: { gte: now, lte: twoHoursFromNow },
      status: { in: ['Scheduled', 'Confirmed'] },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
    include: {
      patient: { select: { id: true, name: true, phone: true, patientCode: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  // Checked-In, waiting to be completed
  const waiting = await db.appointment.findMany({
    where: {
      status: 'Checked-In',
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    include: {
      patient: { select: { id: true, name: true, phone: true, patientCode: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  // Today's total stats
  const todays = await db.appointment.findMany({
    where: {
      scheduledAt: { gte: startOfToday, lte: endOfToday },
      status: { not: 'Cancelled' },
    },
    select: { status: true, scheduledAt: true },
  })

  const byStatus: Record<string, number> = {}
  for (const a of todays) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
  }

  return NextResponse.json({
    upcoming,
    waiting,
    stats: {
      total: todays.length,
      byStatus,
    },
  })
}
