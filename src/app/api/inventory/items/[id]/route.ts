import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const item = await db.inventoryItem.findUnique({
      where: { id },
      include: { category: true, supplier: true, transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(item)
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const body = await req.json()
    const item = await db.inventoryItem.update({
      where: { id },
      data: {
        name: body.name,
        categoryId: body.categoryId,
        supplierId: body.supplierId || null,
        batchNumber: body.batchNumber ?? null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        unit: body.unit ?? null,
        quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
        minStock: body.minStock !== undefined ? Number(body.minStock) : undefined,
        purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) : undefined,
        sellingPrice: body.sellingPrice !== undefined ? Number(body.sellingPrice) : undefined,
        mrp: body.mrp !== undefined ? Number(body.mrp) : undefined,
        gst: body.gst !== undefined ? Number(body.gst) : undefined,
        status: body.status,
      },
      include: { category: true, supplier: true },
    })
    return NextResponse.json(item)
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    await db.inventoryItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
