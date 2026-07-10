import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  status: z.enum(['pending', 'paid']).optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        qty: z.number().min(1).default(1),
        price: z.number().min(0).default(0),
      }),
    )
    .optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const data: Record<string, unknown> = {}
  if (d.status !== undefined) data.status = d.status
  if (d.items !== undefined) {
    data.items = JSON.stringify(d.items)
    data.total = d.items.reduce((s, it) => s + it.qty * it.price, 0)
  }
  const bill = await db.bill.update({
    where: { id },
    data,
    include: { patient: true },
  })
  return NextResponse.json({
    bill: { ...bill, items: JSON.parse(bill.items) },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  await db.bill.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
