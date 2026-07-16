import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

/// Returns daily or monthly revenue aggregates.
/// ?groupby=day (default) | month
/// ?from=YYYY-MM-DD & ?to=YYYY-MM-DD (optional, defaults to last 30 days for day, last 12 months for month)
export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const groupBy = url.searchParams.get('groupby') ?? 'day'
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  // Default ranges
  const now = new Date()
  const defaultFrom = new Date()
  if (groupBy === 'month') {
    defaultFrom.setMonth(defaultFrom.getMonth() - 11) // last 12 months
    defaultFrom.setDate(1)
    defaultFrom.setHours(0, 0, 0, 0)
  } else {
    defaultFrom.setDate(defaultFrom.getDate() - 29) // last 30 days
    defaultFrom.setHours(0, 0, 0, 0)
  }

  const from = fromParam ? new Date(fromParam) : defaultFrom
  const to = toParam ? new Date(toParam) : now
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  // Fetch all bills in range
  const bills = await db.bill.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: {
      total: true,
      amountPaid: true,
      discountAmount: true,
      taxAmount: true,
      consultationFee: true,
      medicineCharges: true,
      labCharges: true,
      otherCharges: true,
      status: true,
      createdAt: true,
    },
  })

  // Group by day or month
  const buckets = new Map<string, {
    label: string
    totalBilled: number
    totalCollected: number
    totalDiscount: number
    totalTax: number
    consultationFees: number
    medicineCharges: number
    labCharges: number
    otherCharges: number
    count: number
    paidCount: number
    pendingCount: number
  }>()

  for (const b of bills) {
    const d = new Date(b.createdAt)
    let key: string
    let label: string
    if (groupBy === 'month') {
      key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    } else {
      key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
      label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
    if (!buckets.has(key)) {
      buckets.set(key, {
        label, totalBilled: 0, totalCollected: 0, totalDiscount: 0, totalTax: 0,
        consultationFees: 0, medicineCharges: 0, labCharges: 0, otherCharges: 0,
        count: 0, paidCount: 0, pendingCount: 0,
      })
    }
    const bucket = buckets.get(key)!
    bucket.totalBilled += b.total
    bucket.totalCollected += b.amountPaid
    bucket.totalDiscount += b.discountAmount
    bucket.totalTax += b.taxAmount
    bucket.consultationFees += b.consultationFee
    bucket.medicineCharges += b.medicineCharges
    bucket.labCharges += b.labCharges
    bucket.otherCharges += b.otherCharges
    bucket.count += 1
    if (b.status === 'Paid') bucket.paidCount += 1
    if (b.status === 'Pending' || b.status === 'Partial') bucket.pendingCount += 1
  }

  // Sort buckets chronologically
  const sortedBuckets = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({
      ...v,
      totalBilled: Math.round(v.totalBilled * 100) / 100,
      totalCollected: Math.round(v.totalCollected * 100) / 100,
      totalDiscount: Math.round(v.totalDiscount * 100) / 100,
      totalTax: Math.round(v.totalTax * 100) / 100,
      consultationFees: Math.round(v.consultationFees * 100) / 100,
      medicineCharges: Math.round(v.medicineCharges * 100) / 100,
      labCharges: Math.round(v.labCharges * 100) / 100,
      otherCharges: Math.round(v.otherCharges * 100) / 100,
    }))

  // Summary
  const summary = {
    totalBilled: sortedBuckets.reduce((s, b) => s + b.totalBilled, 0),
    totalCollected: sortedBuckets.reduce((s, b) => s + b.totalCollected, 0),
    totalDiscount: sortedBuckets.reduce((s, b) => s + b.totalDiscount, 0),
    totalTax: sortedBuckets.reduce((s, b) => s + b.totalTax, 0),
    totalBills: sortedBuckets.reduce((s, b) => s + b.count, 0),
    paidBills: sortedBuckets.reduce((s, b) => s + b.paidCount, 0),
    pendingBills: sortedBuckets.reduce((s, b) => s + b.pendingCount, 0),
    outstanding: 0,
  }
  summary.outstanding = Math.round((summary.totalBilled - summary.totalCollected) * 100) / 100
  summary.totalBilled = Math.round(summary.totalBilled * 100) / 100
  summary.totalCollected = Math.round(summary.totalCollected * 100) / 100
  summary.totalDiscount = Math.round(summary.totalDiscount * 100) / 100
  summary.totalTax = Math.round(summary.totalTax * 100) / 100

  return NextResponse.json({
    groupBy,
    from: from.toISOString(),
    to: to.toISOString(),
    buckets: sortedBuckets,
    summary,
  })
}
