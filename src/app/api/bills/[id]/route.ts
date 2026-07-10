import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'
import { calculateBill, type LineItem, balanceDue, statusAfterPayment } from '@/lib/bill-calc'

const UpdateSchema = z.object({
  consultationFee: z.number().min(0).optional(),
  items: z.array(z.object({
    category: z.enum(['medicine', 'lab', 'other']),
    name: z.string().min(1).max(200),
    qty: z.number().min(1).default(1),
    price: z.number().min(0).default(0),
  })).optional(),
  discountType: z.enum(['percent', 'fixed']).optional(),
  discountValue: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  paymentMethod: z.enum(['Cash', 'Card', 'Online']).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['Pending', 'Partial', 'Paid', 'Refunded']).optional(),
})

const PaymentSchema = z.object({
  amount: z.number().min(0.01),
  method: z.enum(['Cash', 'Card', 'Online']).default('Cash'),
  type: z.enum(['payment', 'refund']).default('payment'),
  note: z.string().max(500).optional().nullable(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const bill = await db.bill.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, name: true, patientCode: true, phone: true, email: true,
          dateOfBirth: true, gender: true, bloodGroup: true, address: true,
        },
      },
      doctor: { select: { id: true, name: true, specialization: true, department: { select: { name: true } } } },
      appointment: { select: { id: true, scheduledAt: true, reason: true, tokenNumber: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  }
  return NextResponse.json({
    bill: { ...bill, items: JSON.parse(bill.items) as LineItem[] },
    balanceDue: balanceDue(bill.total, bill.amountPaid),
  })
}

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

  // Special-case: recording a payment
  if (body && (body.action === 'record-payment' || body.action === 'record-refund')) {
    const parsed = PaymentSchema.safeParse({
      ...body,
      type: body.action === 'record-refund' ? 'refund' : body.type ?? 'payment',
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payment input' },
        { status: 400 },
      )
    }
    const p = parsed.data
    const bill = await db.bill.findUnique({ where: { id }, include: { payments: true } })
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Compute new amountPaid
    const isRefund = p.type === 'refund'
    const newAmountPaid = isRefund
      ? Math.max(0, bill.amountPaid - p.amount)
      : bill.amountPaid + p.amount

    // Determine new status
    let newStatus: 'Pending' | 'Partial' | 'Paid' | 'Refunded'
    if (isRefund) {
      newStatus = 'Refunded'
    } else if (newAmountPaid >= bill.total) {
      newStatus = 'Paid'
    } else if (newAmountPaid > 0) {
      newStatus = 'Partial'
    } else {
      newStatus = 'Pending'
    }

    // Create payment + update bill in a transaction
    const [, updatedBill] = await db.$transaction([
      db.payment.create({
        data: {
          billId: id,
          amount: p.amount,
          method: p.method,
          type: p.type,
          note: p.note?.trim() || null,
        },
      }),
      db.bill.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
          paymentMethod: p.method,
        },
        include: {
          patient: { select: { id: true, name: true, patientCode: true, phone: true } },
          doctor: { select: { id: true, name: true, specialization: true } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      }),
    ])

    return NextResponse.json({
      bill: { ...updatedBill, items: JSON.parse(updatedBill.items) as LineItem[] },
      balanceDue: balanceDue(updatedBill.total, updatedBill.amountPaid),
    })
  }

  // Otherwise: field-level update
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const existing = await db.bill.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  }

  // Recalculate if any charge-related field changed
  const items: LineItem[] = d.items ?? JSON.parse(existing.items)
  const consultationFee = d.consultationFee ?? existing.consultationFee
  const discountType = d.discountType ?? (existing.discountType as 'percent' | 'fixed')
  const discountValue = d.discountValue ?? existing.discountValue
  const taxRate = d.taxRate ?? existing.taxRate

  const calc = calculateBill({ consultationFee, items, discountType, discountValue, taxRate })

  const data: Record<string, unknown> = {
    items: JSON.stringify(items),
    consultationFee: calc.consultationFee,
    medicineCharges: calc.medicineCharges,
    labCharges: calc.labCharges,
    otherCharges: calc.otherCharges,
    subtotal: calc.subtotal,
    discountAmount: calc.discountAmount,
    discountType,
    discountValue,
    taxAmount: calc.taxAmount,
    taxRate,
    total: calc.total,
  }
  if (d.paymentMethod !== undefined) data.paymentMethod = d.paymentMethod ?? null
  if (d.notes !== undefined) data.notes = d.notes?.trim() || null
  if (d.status !== undefined) data.status = d.status

  const bill = await db.bill.update({
    where: { id },
    data,
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  })

  return NextResponse.json({
    bill: { ...bill, items: JSON.parse(bill.items) as LineItem[] },
    balanceDue: balanceDue(bill.total, bill.amountPaid),
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
