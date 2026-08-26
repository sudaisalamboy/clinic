/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  handleApiError,
  safeJson,
  badRequest,
  notFound,
  parsePagination,
  listResponse,
  getClientIp,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { billCreateSchema } from '@/lib/api-schemas'
import {
  toPaise,
  toBps,
  toStoredDiscount,
  toRupees,
  calcBillTotals,
  serializeBill,
  MAX_LINE_ITEM_PAISE,
} from '@/lib/money'
import { ApiError, API_ERROR_CODES, prismaErrorCode, p2002Targets } from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const from = searchParams.get('from')?.trim() || ''
    const to = searchParams.get('to')?.trim() || ''
    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { patientName: { contains: q } },
        { mobile: { contains: q } },
        { billNumber: { contains: q } },
      ]
    }
    if (status && status !== 'all') {
      if (status === 'voided') {
        where.voidedAt = { not: null }
      } else {
        where.paymentStatus = status
        where.voidedAt = null
      }
    }
    if (from || to) {
      const createdAtFilter: Record<string, Date> = {}
      if (from) createdAtFilter.gte = new Date(from)
      if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        createdAtFilter.lte = end
      }
      where.createdAt = createdAtFilter
    }
    const { skip, take } = parsePagination(new URL(req.url))
    const [items, total] = await Promise.all([
      db.bill.findMany({
        where,
        include: { items: true, appointment: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.bill.count({ where }),
    ])
    return listResponse(items.map(serializeBill), total)
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Create a bill.
 *
 * Financial integrity guarantees:
 *  - Line-item prices for INVENTORY items are SERVER-AUTHORITATIVE (the
 *    inventory row's sellingPrice) — a client cannot undercharge/overcharge
 *    by tampering with the request payload. Custom line items (no itemId)
 *    keep their price but are capped.
 *  - Stock is decremented with an atomic guarded UPDATE
 *    (`WHERE quantity >= qty`) — no read-then-write race, no negative stock.
 *  - Every decrement writes a StockTransaction row ('out', bill number in
 *    the note) so the stock ledger stays complete.
 *  - Bill numbers come from a per-year sequence row incremented inside the
 *    same serialized transaction — no string-ordering collision after
 *    9999 bills/year, no retry loop.
 *  - The creation is audited.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = billCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    // Convert API units (rupees / percent) to storage units (paise / bps).
    const consultationPaise = toPaise(d.consultationCharge)
    const discountStored = toStoredDiscount(d.discount, d.discountType)
    const gstBps = toBps(d.gst)

    const created = await db.$transaction(async (tx) => {
      // ---- Bill number: atomic per-year sequence ----
      const year = new Date().getFullYear()
      const seq = await tx.billSequence.upsert({
        where: { year },
        create: { year, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      })
      const billNumber = `BILL-${year}-${String(seq.lastNumber).padStart(4, '0')}`

      // ---- Resolve line items with server-authoritative prices ----
      const itemIds = d.items.map((it) => it.itemId).filter((v): v is string => !!v)
      const invMap = new Map<string, { id: string; name: string; sellingPrice: number; quantity: number; status: string }>()
      if (itemIds.length > 0) {
        const rows = await tx.inventoryItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true, sellingPrice: true, quantity: true, status: true },
        })
        for (const row of rows) invMap.set(row.id, row)
      }

      const lineItems = d.items.map((it) => {
        if (it.itemId) {
          const inv = invMap.get(it.itemId)
          if (!inv) {
            throw new ApiError(API_ERROR_CODES.BAD_REQUEST, `Inventory item not found for "${it.name}"`, 400)
          }
          if (inv.status !== 'Active') {
            throw new ApiError(API_ERROR_CODES.BAD_REQUEST, `"${inv.name}" is inactive and cannot be billed`, 400)
          }
          // SERVER-AUTHORITATIVE price: ignore whatever the client sent.
          return { itemId: it.itemId, name: inv.name, qty: it.qty, price: inv.sellingPrice }
        }
        // Custom (non-inventory) line item: accept the price but cap it.
        const paise = toPaise(it.price)
        if (paise > MAX_LINE_ITEM_PAISE) {
          throw new ApiError(API_ERROR_CODES.BAD_REQUEST, `Price for "${it.name}" exceeds the allowed maximum`, 400)
        }
        return { itemId: null, name: it.name, qty: it.qty, price: paise }
      })

      // ---- Totals: exact integer math in paise ----
      const medicineCharge = lineItems.reduce((s, i) => s + i.qty * i.price, 0)
      const totals = calcBillTotals({
        consultationCharge: consultationPaise,
        medicineCharge,
        discount: discountStored,
        discountType: d.discountType,
        gst: gstBps,
      })

      // ---- Persist ----
      const bill = await tx.bill.create({
        data: {
          billNumber,
          appointmentId: d.appointmentId || null,
          patientId: d.patientId || null,
          patientName: d.patientName,
          mobile: d.mobile ?? null,
          consultationCharge: consultationPaise,
          medicineCharge: totals.medicineCharge,
          discount: discountStored,
          discountType: d.discountType,
          gst: gstBps,
          grandTotal: totals.grandTotal,
          paymentMethod: d.paymentMethod,
          paymentStatus: d.paymentStatus,
          notes: d.notes ?? null,
        },
      })

      if (lineItems.length > 0) {
        await tx.billItem.createMany({
          data: lineItems.map((it) => ({ billId: bill.id, ...it })),
        })
      }

      // ---- Atomic stock decrement + stock ledger ----
      for (const it of lineItems) {
        if (!it.itemId) continue
        const res = await tx.inventoryItem.updateMany({
          where: { id: it.itemId, quantity: { gte: it.qty } },
          data: { quantity: { decrement: it.qty } },
        })
        if (res.count === 0) {
          const inv = invMap.get(it.itemId)
          throw new ApiError(
            API_ERROR_CODES.BAD_REQUEST,
            `Insufficient stock for ${inv?.name ?? 'item'} (available: ${inv?.quantity ?? 0})`,
            400,
          )
        }
        await tx.stockTransaction.create({
          data: {
            itemId: it.itemId,
            type: 'out',
            quantity: it.qty,
            note: `Bill ${billNumber}`,
          },
        })
      }

      return bill
    })

    await writeAudit(
      { userId: user.id, ip: getClientIp(req) },
      'bill.create',
      {
        entity: 'Bill',
        entityId: created.id,
        after: {
          billNumber: created.billNumber,
          patientName: created.patientName,
          grandTotal: toRupees(created.grandTotal),
          paymentStatus: created.paymentStatus,
          itemCount: d.items.length,
        },
      },
    )

    const result = await db.bill.findUnique({
      where: { id: created.id },
      include: { items: { include: { item: true } }, appointment: true },
    })
    // The bill was committed inside the transaction above; a miss here
    // would mean it was deleted between commit and re-fetch (or the DB
    // is corrupt) — surface a 404 rather than crashing on null.
    if (!result) notFound('Bill not found after creation')
    return NextResponse.json(serializeBill(result))
  } catch (e) {
    // A bill already exists for the selected appointment (appointmentId is
    // unique) — distinguish it from a generic unique-constraint failure.
    if (prismaErrorCode(e) === 'P2002' && p2002Targets(e).includes('appointmentId')) {
      return NextResponse.json(
        { error: 'A bill already exists for the selected appointment' },
        { status: 409 },
      )
    }
    return handleApiError(e)
  }
}
