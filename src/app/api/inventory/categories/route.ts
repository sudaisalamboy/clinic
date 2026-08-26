/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError, safeJson, badRequest, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { inventoryCategoryCreateSchema } from '@/lib/api-schemas'

export async function GET() {
  try {
    await requireUser()
    const items = await db.inventoryCategory.findMany({
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(items)
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Create a category (Admin only). When `order` is not supplied, the next
 * position is computed as max(order)+1 INSIDE the same serialized
 * transaction as the insert — previously the aggregate ran outside, so two
 * concurrent creates both read the same max and produced duplicate order
 * values. Prisma opens SQLite transactions with BEGIN IMMEDIATE, which
 * serializes writers and closes the race.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = inventoryCategoryCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    const item = await db.$transaction(async (tx) => {
      const order =
        d.order ??
        ((await tx.inventoryCategory.aggregate({ _max: { order: true } }))._max.order ?? -1) + 1
      return tx.inventoryCategory.create({ data: { name: d.name, order } })
    })

    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'inventory.category.create', {
      entity: 'InventoryCategory',
      entityId: item.id,
      after: { name: item.name, order: item.order },
    })
    return NextResponse.json(item)
  } catch (e) {
    return handleApiError(e)
  }
}
