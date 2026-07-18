/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

function calcGrandTotal(input: {
  consultationCharge: number
  items: { qty: number; price: number }[]
  discount: number
  discountType: string
  gst: number
}): { medicineCharge: number; grandTotal: number } {
  const consultation = Math.max(0, input.consultationCharge || 0)
  const medicineCharge = input.items.reduce(
    (s, i) => s + i.qty * i.price,
    0,
  )
  const subtotal = consultation + medicineCharge
  let discountAmount = 0
  if (input.discountType === 'percent') {
    discountAmount = (subtotal * Math.max(0, input.discount || 0)) / 100
  } else {
    discountAmount = Math.max(0, input.discount || 0)
  }
  discountAmount = Math.min(discountAmount, subtotal)
  const afterDiscount = subtotal - discountAmount
  const gstAmount = (afterDiscount * Math.max(0, input.gst || 0)) / 100
  const grandTotal = Math.max(0, afterDiscount + gstAmount)
  return {
    medicineCharge: Math.round(medicineCharge * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}

async function generateBillNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `BILL-${year}-`
  const last = await db.bill.findFirst({
    where: { billNumber: { startsWith: prefix } },
    orderBy: { billNumber: 'desc' },
  })
  let next = 1
  if (last) {
    const parts = last.billNumber.split('-')
    const n = Number(parts[parts.length - 1])
    if (!Number.isNaN(n)) next = n + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const from = searchParams.get('from')?.trim() || ''
    const to = searchParams.get('to')?.trim() || ''
    const where: any = {}
    if (q) {
      where.OR = [
        { patientName: { contains: q } },
        { mobile: { contains: q } },
        { billNumber: { contains: q } },
      ]
    }
    if (status && status !== 'all') {
      where.paymentStatus = status
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const t = new Date(to)
        t.setHours(23, 59, 59, 999)
        where.createdAt.lte = t
      }
    }
    const items = await db.bill.findMany({
      where,
      include: { items: true, appointment: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(items)
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    await requireUser()
    const body = await req.json()
    const consultationCharge = Number(body.consultationCharge) || 0
    const items: { itemId?: string; name: string; qty: number; price: number }[] =
      body.items || []
    const discount = Number(body.discount) || 0
    const discountType = body.discountType || 'fixed'
    const gst = Number(body.gst) || 0

    const { medicineCharge, grandTotal } = calcGrandTotal({
      consultationCharge,
      items,
      discount,
      discountType,
      gst,
    })

    const billNumber = await generateBillNumber()

    const created = await db.$transaction(async (tx) => {
      const bill = await tx.bill.create({
        data: {
          billNumber,
          appointmentId: body.appointmentId || null,
          patientName: body.patientName,
          mobile: body.mobile || null,
          consultationCharge,
          medicineCharge,
          discount,
          discountType,
          gst,
          grandTotal,
          paymentMethod: body.paymentMethod || 'Cash',
          paymentStatus: body.paymentStatus || 'Pending',
          notes: body.notes || null,
        },
      })
      if (items.length > 0) {
        await tx.billItem.createMany({
          data: items.map((it) => ({
            billId: bill.id,
            itemId: it.itemId || null,
            name: it.name,
            qty: it.qty,
            price: it.price,
          })),
        })
        // Decrement stock + create stock transactions for items with itemId
        for (const it of items) {
          if (it.itemId) {
            await tx.inventoryItem.update({
              where: { id: it.itemId },
              data: { quantity: { decrement: it.qty } },
            })
            await tx.stockTransaction.create({
              data: {
                itemId: it.itemId,
                type: 'out',
                quantity: it.qty,
                note: `Bill ${billNumber}`,
              },
            })
          }
        }
      }
      return bill
    })

    const result = await db.bill.findUnique({
      where: { id: created.id },
      include: { items: { include: { item: true } }, appointment: true },
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
