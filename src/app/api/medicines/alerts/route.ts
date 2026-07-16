import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

/// Returns low-stock + expiry alerts for the dashboard reminder banner.
/// - lowStock: quantity < reorderLevel
/// - expiringSoon: expiry within 30 days (not yet expired)
/// - expired: expiry date in the past
export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const all = await db.medicine.findMany({
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      genericName: true,
      manufacturer: true,
      quantity: true,
      reorderLevel: true,
      expiryDate: true,
      price: true,
    },
  })

  const lowStock = all
    .filter((m) => m.quantity < m.reorderLevel)
    .map((m) => ({
      ...m,
      shortfall: m.reorderLevel - m.quantity,
    }))
    .sort((a, b) => a.shortfall - b.shortfall)

  const expiringSoon = all
    .filter((m) => m.expiryDate && m.expiryDate > now && m.expiryDate <= in30Days)
    .map((m) => ({
      ...m,
      daysToExpiry: Math.ceil((m.expiryDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    }))
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)

  const expired = all
    .filter((m) => m.expiryDate && m.expiryDate < now)
    .map((m) => ({
      ...m,
      daysSinceExpiry: Math.ceil((now.getTime() - m.expiryDate!.getTime()) / (24 * 60 * 60 * 1000)),
    }))
    .sort((a, b) => b.daysSinceExpiry - a.daysSinceExpiry)

  return NextResponse.json({
    lowStock,
    expiringSoon,
    expired,
    summary: {
      lowStockCount: lowStock.length,
      expiringSoonCount: expiringSoon.length,
      expiredCount: expired.length,
      totalValue: all.reduce((s, m) => s + m.quantity * m.price, 0),
    },
  })
}
