import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().max(60).optional().nullable(),
  quantity: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  // restockBy: positive int — adds to current quantity instead of replacing
  restockBy: z.number().int().positive().optional(),
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

  if (d.sku) {
    const exists = await db.medicine.findUnique({ where: { sku: d.sku } })
    if (exists && exists.id !== id) {
      return NextResponse.json(
        { error: 'SKU already exists' },
        { status: 400 },
      )
    }
  }

  const data: Record<string, unknown> = {}
  if (d.name !== undefined) data.name = d.name.trim()
  if (d.sku !== undefined) data.sku = d.sku?.trim() || null
  if (d.price !== undefined) data.price = d.price
  if (d.reorderLevel !== undefined) data.reorderLevel = d.reorderLevel
  if (d.quantity !== undefined) data.quantity = d.quantity
  if (d.restockBy !== undefined) {
    // atomic increment
    await db.medicine.update({
      where: { id },
      data: { quantity: { increment: d.restockBy } },
    })
  } else {
    await db.medicine.update({ where: { id }, data })
  }
  const medicine = await db.medicine.findUnique({ where: { id } })
  return NextResponse.json({ medicine })
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
  await db.medicine.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
