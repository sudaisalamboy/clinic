import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  // --- 4 main stat cards ---
  const totalPatients = await db.patient.count()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const todaysAppointments = await db.appointment.count({
    where: {
      scheduledAt: { gte: startOfToday, lte: endOfToday },
      status: { not: 'cancelled' },
    },
  })

  // Today's revenue = sum of paid bills created today
  const paidBillsToday = await db.bill.findMany({
    where: {
      status: 'paid',
      createdAt: { gte: startOfToday, lte: endOfToday },
    },
    select: { total: true },
  })
  const todaysRevenue = paidBillsToday.reduce((s, b) => s + b.total, 0)

  const pendingBills = await db.bill.count({ where: { status: 'pending' } })

  // --- 7-day appointment bar chart ---
  const days: { date: Date; label: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const next = new Date(d)
    next.setHours(23, 59, 59, 999)
    const count = await db.appointment.count({
      where: {
        scheduledAt: { gte: d, lte: next },
        status: { not: 'cancelled' },
      },
    })
    days.push({
      date: d,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      count,
    })
  }

  // --- Recent 5 patients ---
  const recentPatients = await db.patient.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      phone: true,
      createdAt: true,
    },
  })

  // --- Low stock medicines (quantity < 10) ---
  const lowStockMedicines = await db.medicine.findMany({
    where: { quantity: { lt: 10 } },
    orderBy: { quantity: 'asc' },
    select: {
      id: true,
      name: true,
      sku: true,
      quantity: true,
      reorderLevel: true,
      price: true,
    },
  })

  // --- Extra context for quick actions ---
  const recentPatientsForBooking = await db.patient.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, name: true, phone: true },
  })

  return NextResponse.json({
    stats: {
      totalPatients,
      todaysAppointments,
      todaysRevenue,
      pendingBills,
    },
    chart: days.map((d) => ({ label: d.label, count: d.count })),
    recentPatients,
    lowStockMedicines,
    patientsForBooking: recentPatientsForBooking,
  })
}
