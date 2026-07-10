import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

/// Returns a chronological payment log (most recent first), with bill + patient info.
/// ?limit= (default 100, max 500)
/// ?method= Cash | Card | Online (optional filter)
/// ?from= & ?to= (optional date range)
export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') ?? '100', 10)))
  const method = url.searchParams.get('method')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (method) where.method = method
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.gte = new Date(from)
    if (to) range.lte = new Date(to)
    where.createdAt = range
  }

  const payments = await db.payment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      bill: {
        select: {
          id: true,
          billNumber: true,
          total: true,
          amountPaid: true,
          status: true,
          patient: { select: { id: true, name: true, patientCode: true } },
        },
      },
    },
  })

  // Summary
  const summary = {
    totalCollected: payments
      .filter((p) => p.type === 'payment')
      .reduce((s, p) => s + p.amount, 0),
    totalRefunded: payments
      .filter((p) => p.type === 'refund')
      .reduce((s, p) => s + p.amount, 0),
    count: payments.length,
    byMethod: {
      Cash: payments.filter((p) => p.method === 'Cash' && p.type === 'payment').reduce((s, p) => s + p.amount, 0),
      Card: payments.filter((p) => p.method === 'Card' && p.type === 'payment').reduce((s, p) => s + p.amount, 0),
      Online: payments.filter((p) => p.method === 'Online' && p.type === 'payment').reduce((s, p) => s + p.amount, 0),
    },
  }
  summary.totalCollected = Math.round(summary.totalCollected * 100) / 100
  summary.totalRefunded = Math.round(summary.totalRefunded * 100) / 100
  summary.byMethod.Cash = Math.round(summary.byMethod.Cash * 100) / 100
  summary.byMethod.Card = Math.round(summary.byMethod.Card * 100) / 100
  summary.byMethod.Online = Math.round(summary.byMethod.Online * 100) / 100

  return NextResponse.json({ payments, summary })
}
