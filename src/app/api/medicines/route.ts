import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const MedicineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sku: z.string().max(60).optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  price: z.number().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(10),
})

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const lowOnly = url.searchParams.get('low') === '1'

  const where: Record<string, unknown> = {}
  if (q) where.name = { contains: q }
  if (lowOnly) where.quantity = { lt: 10 }

  const medicines = await db.medicine.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 500,
  })

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
      return NextResponse.json(
        { error: 'SKU already exists' },
        { status: 400 },
      )
    }
  }
  const medicine = await db.medicine.create({
    data: {
      name: d.name.trim(),
      sku: d.sku?.trim() || null,
      quantity: d.quantity,
      price: d.price,
      reorderLevel: d.reorderLevel,
    },
  })
  return NextResponse.json({ medicine })
}
