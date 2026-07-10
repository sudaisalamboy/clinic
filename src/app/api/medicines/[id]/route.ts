import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  genericName: z.string().max(200).optional().nullable(),
  sku: z.string().max(60).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  batchNumber: z.string().max(100).optional().nullable(),
  quantity: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  purchasePrice: z.number().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  expiryDate: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  /// Positive int — adds to current quantity (restock)
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
      return NextResponse.json({ error: 'SKU already exists' }, { status: 400 })
    }
  }

  // Restock = atomic increment, returns the updated row
  if (d.restockBy !== undefined) {
    await db.medicine.update({
      where: { id },
      data: { quantity: { increment: d.restockBy } },
    })
  } else {
    const data: Record<string, unknown> = {}
    if (d.name !== undefined) data.name = d.name.trim()
    if (d.genericName !== undefined) data.genericName = d.genericName?.trim() || null
    if (d.sku !== undefined) data.sku = d.sku?.trim() || null
    if (d.manufacturer !== undefined) data.manufacturer = d.manufacturer?.trim() || null
    if (d.batchNumber !== undefined) data.batchNumber = d.batchNumber?.trim() || null
    if (d.quantity !== undefined) data.quantity = d.quantity
    if (d.price !== undefined) data.price = d.price
    if (d.purchasePrice !== undefined) data.purchasePrice = d.purchasePrice
    if (d.reorderLevel !== undefined) data.reorderLevel = d.reorderLevel
    if (d.description !== undefined) data.description = d.description?.trim() || null
    if (d.expiryDate !== undefined) {
      data.expiryDate = d.expiryDate ? new Date(d.expiryDate) : null
    }
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
