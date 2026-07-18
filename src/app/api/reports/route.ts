/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')?.trim() || ''
    const to = searchParams.get('to')?.trim() || ''

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const rangeStart = from ? new Date(from) : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    rangeStart.setHours(0, 0, 0, 0)
    const rangeEnd = to ? new Date(to) : new Date(now)
    rangeEnd.setHours(23, 59, 59, 999)

    // Dashboard stats
    const [
      todaysAppointments,
      todaysBillsAgg,
      totalBills,
      lowStockItems,
      expiringItems,
      totalStaff,
      totalInventoryItems,
    ] = await Promise.all([
      db.appointment.count({ where: { date: { gte: todayStart, lte: todayEnd } } }),
      db.bill.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, paymentStatus: 'Paid' },
        _sum: { grandTotal: true },
      }),
      db.bill.count(),
      db.inventoryItem.findMany({
        where: { quantity: { lte: 0 } },
        include: { category: true },
      }),
      db.inventoryItem.findMany({
        where: {
          expiryDate: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: { category: true },
      }),
      db.staff.count(),
      db.inventoryItem.count(),
    ])

    // Daily revenue in range
    const billsInRange = await db.bill.findMany({
      where: { createdAt: { gte: rangeStart, lte: rangeEnd }, paymentStatus: 'Paid' },
      select: { createdAt: true, grandTotal: true },
    })
    const dayMap = new Map<string, { revenue: number; bills: number }>()
    for (const b of billsInRange) {
      const d = new Date(b.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const entry = dayMap.get(key) || { revenue: 0, bills: 0 }
      entry.revenue += b.grandTotal
      entry.bills += 1
      dayMap.set(key, entry)
    }
    const dailyRevenue: { date: string; revenue: number; bills: number }[] = []
    const cursor = new Date(rangeStart)
    while (cursor <= rangeEnd) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const entry = dayMap.get(key) || { revenue: 0, bills: 0 }
      dailyRevenue.push({ date: key, revenue: Math.round(entry.revenue * 100) / 100, bills: entry.bills })
      cursor.setDate(cursor.getDate() + 1)
    }

    // Appointment status breakdown
    const apptsInRange = await db.appointment.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      select: { status: true },
    })
    const statusMap = new Map<string, number>()
    for (const a of apptsInRange) {
      statusMap.set(a.status, (statusMap.get(a.status) || 0) + 1)
    }
    const appointmentStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

    // Recent appointments
    const recentAppointments = await db.appointment.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { staff: true },
    })

    return NextResponse.json({
      dashboard: {
        todaysAppointments,
        todaysRevenue: todaysBillsAgg._sum.grandTotal || 0,
        totalBills,
        lowStockCount: lowStockItems.length,
        expiringCount: expiringItems.length,
        totalStaff,
        totalInventoryItems,
      },
      dailyRevenue,
      appointmentStatus,
      recentAppointments,
      lowStockItems,
      expiringItems,
    })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
