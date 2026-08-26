/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError, safeJson, badRequest, notFound, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { stockTransactionSchema } from '@/lib/api-schemas'
import { serializeInventoryItem } from '@/lib/money'

/**
 * Record a stock movement. All four types are supported with the correct
 * direction (a previous bug made 'return' SUBTRACT stock):
 *
 *   in     → +qty  (new stock delivered)
 *   return → +qty  (medicine returned by a patient / voided bill)
 *   out    → −qty  (damaged, expired, dispensed outside billing, …)
 *   adjust →  =qty  (stock-take correction: set ABSOLUTE level)
 *
 * Concurrency safety: the read, the guarded decrement (WHERE quantity >=
 * qty), the StockTransaction insert, and the item update all run inside ONE
 * interactive transaction. Prisma uses BEGIN IMMEDIATE on SQLite, so
 * writers are serialized — two concurrent requests can never both read the
 * same pre-update quantity. The 'out' path additionally uses a guarded
 * atomic update so insufficient stock fails without ever going negative.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = stockTransactionSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    const result = await db.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: d.itemId },
        include: { category: true, supplier: true },
      })
      if (!item) notFound('Item not found')

      let newQuantity: number

      if (d.type === 'in' || d.type === 'return') {
        // Increment — always safe, no lower bound to violate.
        const res = await tx.inventoryItem.updateMany({
          where: { id: d.itemId },
          data: { quantity: { increment: d.quantity } },
        })
        if (res.count === 0) notFound('Item not found')
        newQuantity = item.quantity + d.quantity
      } else if (d.type === 'out') {
        // Guarded atomic decrement — can never drive stock negative, even
        // under concurrent billing/stock-out traffic.
        const res = await tx.inventoryItem.updateMany({
          where: { id: d.itemId, quantity: { gte: d.quantity } },
          data: { quantity: { decrement: d.quantity } },
        })
        if (res.count === 0) {
          badRequest(`Insufficient stock for ${item.name} (available: ${item.quantity})`)
        }
        newQuantity = item.quantity - d.quantity
      } else {
        // adjust → absolute level. The transaction serializes the
        // read-then-set against other writers, so a concurrent bill
        // decrement cannot be silently lost.
        if (d.quantity === item.quantity) {
          // No-op adjustment still records the stock-take for the ledger.
          newQuantity = item.quantity
        } else {
          await tx.inventoryItem.update({
            where: { id: d.itemId },
            data: { quantity: d.quantity },
          })
          newQuantity = d.quantity
        }
      }

      const txn = await tx.stockTransaction.create({
        data: {
          itemId: d.itemId,
          type: d.type,
          quantity: d.quantity,
          note: d.note ?? null,
        },
      })

      return { item, txn, newQuantity }
    })

    // Every stock movement is audited — the ledger is the audit trail's
    // backbone (direct quantity edits are impossible by design).
    await writeAudit(
      { userId: user.id, ip: getClientIp(req) },
      'stock.transaction',
      {
        entity: 'InventoryItem',
        entityId: d.itemId,
        before: { quantity: result.item.quantity },
        after: { quantity: result.newQuantity, type: d.type, moved: d.quantity },
      },
    )

    const updated = await db.inventoryItem.findUnique({
      where: { id: d.itemId },
      include: { category: true, supplier: true },
    })
    // The movement committed inside the transaction above; a miss here
    // means the item vanished mid-request — 404 instead of a null crash.
    if (!updated) notFound('Item not found')

    return NextResponse.json({
      item: serializeInventoryItem(updated),
      transaction: result.txn,
    })
  } catch (e) {
    return handleApiError(e)
  }
}
