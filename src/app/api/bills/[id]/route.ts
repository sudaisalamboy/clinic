import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const item = await db.bill.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, appointment: true },
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
    const data: any = {}
    if (body.paymentStatus !== undefined) data.paymentStatus = body.paymentStatus
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod
    if (body.notes !== undefined) data.notes = body.notes
    if (body.discount !== undefined) data.discount = Number(body.discount)
    if (body.discountType !== undefined) data.discountType = body.discountType
    if (body.gst !== undefined) data.gst = Number(body.gst)
    // Recalculate grand total if discount/gst changed
    if (body.discount !== undefined || body.gst !== undefined) {
      const current = await db.bill.findUnique({ where: { id }, include: { items: true } })
      if (current) {
        const consultation = current.consultationCharge
        const medicineCharge = current.items.reduce((s, i) => s + i.qty * i.price, 0)
        const subtotal = consultation + medicineCharge
        const discount = body.discount !== undefined ? Number(body.discount) : current.discount
        const discountType = body.discountType || current.discountType
        const gst = body.gst !== undefined ? Number(body.gst) : current.gst
        let discountAmount = 0
        if (discountType === 'percent') {
          discountAmount = (subtotal * Math.max(0, discount)) / 100
        } else {
          discountAmount = Math.max(0, discount)
        }
        discountAmount = Math.min(discountAmount, subtotal)
        const afterDiscount = subtotal - discountAmount
        const gstAmount = (afterDiscount * Math.max(0, gst)) / 100
        data.grandTotal = Math.round((afterDiscount + gstAmount) * 100) / 100
        data.medicineCharge = Math.round(medicineCharge * 100) / 100
      }
    }
    const item = await db.bill.update({
      where: { id },
      data,
      include: { items: { include: { item: true } }, appointment: true },
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
    await db.bill.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
