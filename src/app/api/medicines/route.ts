import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const MedicineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  genericName: z.string().max(200).optional().nullable(),
  sku: z.string().max(60).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  batchNumber: z.string().max(100).optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  price: z.number().min(0).default(0),
  purchasePrice: z.number().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(10),
  expiryDate: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const filter = url.searchParams.get('filter') ?? 'all' // all | low | expiring | expired
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') ?? '500', 10)))

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { genericName: { contains: q } },
      { manufacturer: { contains: q } },
      { sku: { contains: q } },
    ]
  }

  // Prisma can't express cross-column comparisons (`quantity < reorderLevel`) in
  // a single where clause, so we fetch all matches and filter in JS.
  let medicines = await db.medicine.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    take: limit,
  })

  // Apply cross-column / date filters in JS
  if (filter === 'low') {
    medicines = medicines.filter((m) => m.quantity < m.reorderLevel)
  } else if (filter === 'expiring') {
    medicines = medicines.filter(
      (m) => m.expiryDate && m.expiryDate > now && m.expiryDate <= in30Days,
    )
  } else if (filter === 'expired') {
    medicines = medicines.filter((m) => m.expiryDate && m.expiryDate < now)
  }

  return NextResponse.json({ medicines })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = MedicineSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data

  if (d.sku) {
    const exists = await db.medicine.findUnique({ where: { sku: d.sku } })
    if (exists) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 400 })
    }
  }

  let expiryDate: Date | null = null
  if (d.expiryDate) {
    expiryDate = new Date(d.expiryDate)
    if (isNaN(expiryDate.getTime())) expiryDate = null
  }

  const medicine = await db.medicine.create({
    data: {
      name: d.name.trim(),
      genericName: d.genericName?.trim() || null,
      sku: d.sku?.trim() || null,
      manufacturer: d.manufacturer?.trim() || null,
      batchNumber: d.batchNumber?.trim() || null,
      quantity: d.quantity,
      price: d.price,
      purchasePrice: d.purchasePrice,
      reorderLevel: d.reorderLevel,
      expiryDate,
      description: d.description?.trim() || null,
    },
  })
  return NextResponse.json({ medicine })
}
