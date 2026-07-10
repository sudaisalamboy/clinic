import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const BillItemSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().min(1).default(1),
  price: z.number().min(0).default(0),
})

const BillSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().nullable(),
  items: z.array(BillItemSchema).min(1, 'At least one item is required'),
  status: z.enum(['pending', 'paid']).default('pending'),
})

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const patientId = url.searchParams.get('patientId')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (patientId) where.patientId = patientId

  const bills = await db.bill.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { patient: true },
    take: 200,
  })

  return NextResponse.json({
    bills: bills.map((b) => ({
      ...b,
      items: JSON.parse(b.items),
    })),
  })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = BillSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const patient = await db.patient.findUnique({ where: { id: d.patientId } })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const total = d.items.reduce((s, it) => s + it.qty * it.price, 0)
  const bill = await db.bill.create({
    data: {
      patientId: d.patientId,
      appointmentId: d.appointmentId ?? null,
      items: JSON.stringify(d.items),
      total,
      status: d.status,
    },
    include: { patient: true },
  })

  // Decrement medicine stock if any item name matches a medicine name
  for (const item of d.items) {
    const med = await db.medicine.findFirst({
      where: { name: { equals: item.name } },
    })
    if (med && med.quantity >= item.qty) {
      await db.medicine.update({
        where: { id: med.id },
        data: { quantity: { decrement: item.qty } },
      })
    }
  }

  return NextResponse.json({
    bill: { ...bill, items: JSON.parse(bill.items) },
  })
}
