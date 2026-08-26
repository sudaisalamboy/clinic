/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  handleApiError,
  safeJson,
  badRequest,
  forbidden,
  notFound,
  getClientIp,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { billUpdateSchema, idParamSchema } from '@/lib/api-schemas'
import {
  toBps,
  toPercent,
  toRupees,
  toStoredDiscount,
  discountFromStored,
  calcBillTotals,
  serializeBill,
} from '@/lib/money'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser()
    const { id } = idParamSchema.parse(await params)
    const item = await db.bill.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, appointment: true },
    })
    if (!item) notFound('Bill not found')
    return NextResponse.json(serializeBill(item))
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Update a bill.
 *
 * Financial integrity rules:
 *  - VOIDED bills are immutable.
 *  - PAID bills are immutable (a receptionist must not be able to zero out
 *    a bill the patient already settled — that is a classic cash-siphon
 *    vector). Corrections require an Admin to VOID the bill (stock is
 *    restored) and reissue a new one, leaving a full audit trail.
 *  - On unpaid bills, discount / GST edits recompute the grand total with
 *    exact integer math from the STORED line items.
 *
 * Race safety: the state checks, the totals recompute, and the write all
 * run inside ONE interactive transaction. Prisma opens SQLite
 * transactions with BEGIN IMMEDIATE, serializing writers — so a
 * concurrent "mark paid" + "edit discount" pair can never interleave
 * (both would previously observe `Pending` and the paid bill would end
 * up with a tampered discount). The guarded `updateMany` below is a
 * second lock on the same door: even under a hypothetical deferred
 * BEGIN, the UPDATE itself refuses to touch a Paid/Voided row.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = idParamSchema.parse(await params)
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = billUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    const { before, item } = await db.$transaction(async (tx) => {
      // Read INSIDE the transaction — this is the state the guard and the
      // totals recompute are validated against.
      const current = await tx.bill.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!current) notFound('Bill not found')

      if (current.voidedAt) {
        forbidden('This bill is voided and can no longer be modified.')
      }
      if (current.paymentStatus === 'Paid') {
        forbidden(
          'Paid bills are immutable. Ask an admin to void this bill and issue a corrected one.',
        )
      }

      const updateData: Record<string, unknown> = {}
      if (d.paymentStatus !== undefined) updateData.paymentStatus = d.paymentStatus
      if (d.paymentMethod !== undefined) updateData.paymentMethod = d.paymentMethod
      if (d.notes !== undefined) updateData.notes = d.notes

      const discountChanged =
        d.discount !== undefined || d.gst !== undefined || d.discountType !== undefined

      if (discountChanged) {
        // Recompute totals with exact integer math from STORED values.
        const medicineCharge = current.items.reduce((s, i) => s + i.qty * i.price, 0)
        const discountType = d.discountType ?? current.discountType
        const discountApi =
          d.discount !== undefined
            ? d.discount
            : discountFromStored(current.discount, discountType)
        const gstPercent = d.gst !== undefined ? d.gst : toPercent(current.gst)

        const discountStored = toStoredDiscount(discountApi, discountType)
        const totals = calcBillTotals({
          consultationCharge: current.consultationCharge,
          medicineCharge,
          discount: discountStored,
          discountType,
          gst: toBps(gstPercent),
        })

        updateData.discount = discountStored
        updateData.discountType = discountType
        updateData.gst = toBps(gstPercent)
        updateData.medicineCharge = totals.medicineCharge
        updateData.grandTotal = totals.grandTotal
      }

      // Guarded write: the WHERE clause re-asserts every invariant the
      // checks above verified. If a concurrent writer flipped this bill to
      // Paid/Voided in the window since the read, count === 0 and NOTHING
      // is written.
      const claim = await tx.bill.updateMany({
        where: { id, voidedAt: null, paymentStatus: { not: 'Paid' } },
        data: updateData,
      })
      if (claim.count === 0) {
        forbidden(
          'This bill was paid or voided while you were editing it. Reload the bill and try again.',
        )
      }

      const updated = await tx.bill.findUnique({
        where: { id },
        include: { items: { include: { item: true } }, appointment: true },
      })
      // Unreachable in practice (the row exists — we just updated it),
      // but findUnique is nullable so narrow it for the serializer.
      if (!updated) notFound('Bill not found after update')
      return { before: current, item: updated }
    })

    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'bill.update', {
      entity: 'Bill',
      entityId: id,
      before: {
        paymentStatus: before.paymentStatus,
        paymentMethod: before.paymentMethod,
        discount: discountFromStored(before.discount, before.discountType),
        gst: toPercent(before.gst),
        grandTotal: toRupees(before.grandTotal),
      },
      after: {
        paymentStatus: item.paymentStatus,
        paymentMethod: item.paymentMethod,
        discount: discountFromStored(item.discount, item.discountType),
        gst: toPercent(item.gst),
        grandTotal: toRupees(item.grandTotal),
      },
    })

    return NextResponse.json(serializeBill(item))
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * VOID a bill (Admin only) — the only allowed "delete".
 *
 *  - The row is NEVER hard-deleted: voidedAt is stamped so the financial
 *    record survives for audit.
 *  - Stock that was decremented when the bill was created is RESTORED, and
 *    each restoration writes a 'return' StockTransaction row referencing
 *    the bill number.
 *  - The void is audited (who voided which bill and why the stock moved).
 *
 * Race safety: the void stamp is a GUARDED conditional update INSIDE the
 * transaction — `WHERE voidedAt IS NULL`. If two admins void the same
 * bill concurrently, exactly one claim succeeds; the loser sees
 * count === 0 and aborts BEFORE any stock is touched, so inventory can
 * never be double-credited and only one 'return' ledger row is written
 * per bill item.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)

    // Pre-check for a clean 404 and the audit snapshot. BillItems are
    // immutable after creation (no endpoint mutates them), so the
    // restorable list read here cannot go stale; the authoritative
    // void guard is the conditional update inside the transaction.
    const current = await db.bill.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!current) notFound('Bill not found')

    const restorable = current.items.filter((it) => it.itemId)
    const voidedAt = new Date()

    await db.$transaction(async (tx) => {
      // Claim the void atomically: null → timestamp. Losers get count === 0.
      const claim = await tx.bill.updateMany({
        where: { id, voidedAt: null },
        data: { voidedAt, voidReason: 'Voided by admin' },
      })
      if (claim.count === 0) {
        badRequest('This bill is already voided')
      }

      // Only the winner of the claim restores stock.
      for (const it of restorable) {
        await tx.inventoryItem.update({
          where: { id: it.itemId as string },
          data: { quantity: { increment: it.qty } },
        })
        await tx.stockTransaction.create({
          data: {
            itemId: it.itemId as string,
            type: 'return',
            quantity: it.qty,
            note: `Void ${current.billNumber}`,
          },
        })
      }
    })

    await writeAudit({ userId: user.id, ip: getClientIp(_req) }, 'bill.void', {
      entity: 'Bill',
      entityId: id,
      before: {
        billNumber: current.billNumber,
        patientName: current.patientName,
        grandTotal: toRupees(current.grandTotal),
        paymentStatus: current.paymentStatus,
      },
      after: {
        billNumber: current.billNumber,
        voidedAt: voidedAt.toISOString(),
        stockRestored: restorable.map((it) => ({ itemId: it.itemId, qty: it.qty })),
      },
    })

    return NextResponse.json({ ok: true, voided: true })
  } catch (e) {
    return handleApiError(e)
  }
}
