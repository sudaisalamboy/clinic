/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'
import { getSettings } from '@/lib/settings'
import { toRupees, serializeInventoryItem, serializeAppointment } from '@/lib/money'
import {
  isValidTimeZone,
  zonedDateKey,
  zonedDayStart,
  zonedDayEnd,
  todayKey,
  dayKeyRange,
} from '@/lib/time'

/**
 * Dashboard / reports analytics.
 *
 * Correctness properties:
 *  - "Today" and every day boundary are computed in the CLINIC's timezone
 *    (Settings.timezone) — not the server's. A UTC server would otherwise
 *    misalign the clinic's day by 5½ hours (IST).
 *  - Revenue counts only PAID, NON-VOIDED bills. Voided bills are excluded
 *    even if they were paid before being voided.
 *  - Money aggregates are exact integer paise (converted to rupees only on
 *    the way out).
 *  - Low-stock/expiring queries fetch only the columns they need and only
 *    ACTIVE items (inactive stock is not operationally low/expiring).
 */
export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')?.trim() || ''
    const to = searchParams.get('to')?.trim() || ''

    const settings = await getSettings()
    const tz = isValidTimeZone(settings.timezone) ? settings.timezone : 'UTC'

    const now = new Date()
    const tKey = todayKey(tz)
    const todayStart = zonedDayStart(tKey, tz)
    const todayEnd = zonedDayEnd(tKey, tz)

    // Range defaults: last 14 days (clinic-local), inclusive.
    const fromKey = from || zonedDateKey(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000), tz)
    const toKey = to || tKey
    const rangeStart = zonedDayStart(fromKey, tz)
    const rangeEnd = zonedDayEnd(toKey, tz)

    // Paid, non-voided bills only.
    const revenueFilter = {
      createdAt: { gte: rangeStart, lte: rangeEnd },
      paymentStatus: 'Paid' as const,
      voidedAt: null,
    }
    const todayRevenueFilter = {
      createdAt: { gte: todayStart, lte: todayEnd },
      paymentStatus: 'Paid' as const,
      voidedAt: null,
    }

    const [
      todaysAppointments,
      todaysBillsAgg,
      totalBills,
      lowStockCandidates,
      expiringItems,
      totalStaff,
      totalInventoryItems,
    ] = await Promise.all([
      db.appointment.count({ where: { date: { gte: todayStart, lte: todayEnd } } }),
      db.bill.aggregate({
        where: todayRevenueFilter,
        _sum: { grandTotal: true },
      }),
      db.bill.count({ where: { voidedAt: null } }),
      // Select-only projection (no relations) keeps this cheap even with a
      // large catalogue; Prisma cannot compare two columns so the
      // quantity <= minStock comparison stays in JS over ACTIVE rows only.
      db.inventoryItem.findMany({
        where: { status: 'Active' },
        select: {
          id: true,
          name: true,
          quantity: true,
          minStock: true,
          unit: true,
          purchasePrice: true,
          sellingPrice: true,
          mrp: true,
          gst: true,
          status: true,
          batchNumber: true,
          expiryDate: true,
          categoryId: true,
          supplierId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.inventoryItem.findMany({
        where: {
          status: 'Active',
          expiryDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          name: true,
          quantity: true,
          minStock: true,
          unit: true,
          purchasePrice: true,
          sellingPrice: true,
          mrp: true,
          gst: true,
          status: true,
          batchNumber: true,
          expiryDate: true,
          categoryId: true,
          supplierId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.staff.count(),
      db.inventoryItem.count({ where: { status: 'Active' } }),
    ])

    const lowStockItems = lowStockCandidates.filter((i) => i.quantity <= i.minStock)

    // Daily revenue in range, grouped by CLINIC-TIMEZONE calendar day.
    const billsInRange = await db.bill.findMany({
      where: revenueFilter,
      select: { createdAt: true, grandTotal: true },
    })
    const dayMap = new Map<string, { revenuePaise: number; bills: number }>()
    for (const b of billsInRange) {
      const key = zonedDateKey(b.createdAt, tz)
      const entry = dayMap.get(key) || { revenuePaise: 0, bills: 0 }
      entry.revenuePaise += b.grandTotal
      entry.bills += 1
      dayMap.set(key, entry)
    }
    const dailyRevenue = dayKeyRange(fromKey, toKey).map((key) => {
      const entry = dayMap.get(key) || { revenuePaise: 0, bills: 0 }
      return { date: key, revenue: toRupees(entry.revenuePaise), bills: entry.bills }
    })

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
        todaysRevenue: toRupees(todaysBillsAgg._sum.grandTotal ?? 0),
        totalBills,
        lowStockCount: lowStockItems.length,
        expiringCount: expiringItems.length,
        totalStaff,
        totalInventoryItems,
      },
      dailyRevenue,
      appointmentStatus,
      recentAppointments: recentAppointments.map(serializeAppointment),
      lowStockItems: lowStockItems.map(serializeInventoryItem),
      expiringItems: expiringItems.map(serializeInventoryItem),
    })
  } catch (e) {
    return handleApiError(e)
  }
}
