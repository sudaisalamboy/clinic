import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'
import { calculateBill, type LineItem } from '@/lib/bill-calc'

const LineItemSchema = z.object({
  category: z.enum(['medicine', 'lab', 'other']),
  name: z.string().min(1).max(200),
  qty: z.number().min(1).default(1),
  price: z.number().min(0).default(0),
})

const BillSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  consultationFee: z.number().min(0).default(0),
  items: z.array(LineItemSchema).default([]),
  discountType: z.enum(['percent', 'fixed']).default('fixed'),
  discountValue: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
  paymentMethod: z.enum(['Cash', 'Card', 'Online']).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  /// Optional initial payment; if provided, a Payment row is created.
  initialPayment: z
    .object({
      amount: z.number().min(0),
      method: z.enum(['Cash', 'Card', 'Online']).default('Cash'),
      note: z.string().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
})

/** Generates the next bill number like BILL-2026-0001. */
async function generateBillNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `BILL-${year}-`
  const existing = await db.bill.findMany({
    where: { billNumber: { startsWith: prefix } },
    select: { billNumber: true },
  })
  let max = 0
  for (const b of existing) {
    const n = parseInt(b.billNumber.slice(prefix.length), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${prefix}${(max + 1).toString().padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const patientId = url.searchParams.get('patientId')
  const doctorId = url.searchParams.get('doctorId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') ?? '50', 10)))

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (patientId) where.patientId = patientId
  if (doctorId) where.doctorId = doctorId
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.gte = new Date(from)
    if (to) range.lte = new Date(to)
    where.createdAt = range
  }

  const [total, bills] = await Promise.all([
    db.bill.count({ where }),
    db.bill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        patient: { select: { id: true, name: true, patientCode: true, phone: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        _count: { select: { payments: true } },
      },
    }),
  ])

  return NextResponse.json({
    bills: bills.map((b) => ({
      ...b,
      items: JSON.parse(b.items) as LineItem[],
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
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

  // Validate patient
  const patient = await db.patient.findUnique({ where: { id: d.patientId } })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }
  // Validate doctor
  if (d.doctorId) {
    const doctor = await db.doctor.findUnique({ where: { id: d.doctorId } })
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
  }

  // Auto-fill consultation fee from doctor if not explicitly provided
  let consultationFee = d.consultationFee
  if (d.doctorId && consultationFee === 0) {
    const doc = await db.doctor.findUnique({ where: { id: d.doctorId }, select: { consultationFee: true } })
    if (doc) consultationFee = doc.consultationFee
  }

  // Calculate totals
  const calc = calculateBill({
    consultationFee,
    items: d.items,
    discountType: d.discountType,
    discountValue: d.discountValue,
    taxRate: d.taxRate,
  })

  // Generate bill number
  let billNumber = ''
  for (let i = 0; i < 3; i++) {
    const candidate = await generateBillNumber()
    const exists = await db.bill.findUnique({ where: { billNumber: candidate } })
    if (!exists) { billNumber = candidate; break }
  }
  if (!billNumber) {
    return NextResponse.json({ error: 'Failed to generate bill number' }, { status: 500 })
  }

  // Determine initial status + amountPaid
  let amountPaid = 0
  let status: 'Pending' | 'Partial' | 'Paid' = 'Pending'
  if (d.initialPayment && d.initialPayment.amount > 0) {
    amountPaid = d.initialPayment.amount
    if (amountPaid >= calc.total) status = 'Paid'
    else status = 'Partial'
  }

  // Create the bill + optional initial payment in a transaction
  const bill = await db.bill.create({
    data: {
      billNumber,
      patientId: d.patientId,
      doctorId: d.doctorId || null,
      appointmentId: d.appointmentId || null,
      items: JSON.stringify(d.items),
      consultationFee: calc.consultationFee,
      medicineCharges: calc.medicineCharges,
      labCharges: calc.labCharges,
      otherCharges: calc.otherCharges,
      subtotal: calc.subtotal,
      discountAmount: calc.discountAmount,
      discountType: d.discountType,
      discountValue: d.discountValue,
      taxAmount: calc.taxAmount,
      taxRate: d.taxRate,
      total: calc.total,
      amountPaid,
      status,
      paymentMethod: d.paymentMethod ?? null,
      notes: d.notes?.trim() || null,
      payments: d.initialPayment && d.initialPayment.amount > 0
        ? {
            create: {
              amount: d.initialPayment.amount,
              method: d.initialPayment.method,
              type: 'payment',
              note: d.initialPayment.note?.trim() || null,
            },
          }
        : undefined,
    },
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  })

  // Decrement medicine stock for medicine items
  for (const item of d.items) {
    if (item.category !== 'medicine') continue
    const med = await db.medicine.findFirst({ where: { name: { equals: item.name } } })
    if (med && med.quantity >= item.qty) {
      await db.medicine.update({
        where: { id: med.id },
        data: { quantity: { decrement: item.qty } },
      })
    }
  }

  return NextResponse.json({
    bill: { ...bill, items: JSON.parse(bill.items) as LineItem[] },
  })
}
