import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  try {
    await requireUser()
    const body = await req.json()
    const { itemId, type, quantity, note } = body
    if (!itemId || !type || !quantity) {
      return NextResponse.json(
        { error: 'itemId, type, quantity are required' },
        { status: 400 },
      )
    }
    const qty = Number(quantity)
    if (qty <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be positive' },
        { status: 400 },
      )
    }
    const item = await db.inventoryItem.findUnique({ where: { id: itemId } })
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const newQty =
      type === 'in' ? item.quantity + qty : item.quantity - qty
    if (newQty < 0) {
      return NextResponse.json(
        { error: 'Insufficient stock' },
        { status: 400 },
      )
    }

    const [updatedItem, tx] = await db.$transaction([
      db.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: newQty },
        include: { category: true, supplier: true },
      }),
      db.stockTransaction.create({
        data: {
          itemId,
          type,
          quantity: qty,
          note: note || null,
        },
      }),
    ])

    return NextResponse.json({ item: updatedItem, transaction: tx })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
