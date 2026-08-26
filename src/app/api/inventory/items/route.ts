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
  parsePagination,
  listResponse,
  getClientIp,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { inventoryItemCreateSchema } from '@/lib/api-schemas'
import { toPaise, toBps, serializeInventoryItem } from '@/lib/money'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const category = searchParams.get('category')?.trim() || ''
    const filter = searchParams.get('filter')?.trim() || ''
    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { batchNumber: { contains: q } },
      ]
    }
    if (category && category !== 'all') {
      where.categoryId = category
    }

    // Expiry-based filters run DB-side (no fetch-everything-then-JS-filter)
    // and only consider ACTIVE items — inactive/expired stock is not
    // operationally "low" or "expiring".
    const now = new Date()
    const within30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (filter === 'expiring') {
      where.status = 'Active'
      where.expiryDate = { gte: now, lte: within30 }
    } else if (filter === 'expired') {
      where.status = 'Active'
      where.expiryDate = { lt: now }
    } else if (filter === 'low') {
      where.status = 'Active'
    }

    const { skip, take } = parsePagination(new URL(req.url))
    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        include: { category: true, supplier: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.inventoryItem.count({ where }),
    ])

    // `low` compares quantity <= minStock — two columns, which Prisma
    // cannot express — so it stays a JS filter, but over the already
    // q/category/pagination-filtered ACTIVE rows only.
    let result = items
    if (filter === 'low') {
      result = items.filter((i) => i.quantity <= i.minStock)
    }

    return listResponse(result.map(serializeInventoryItem), total)
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Create an inventory item (Admin only — item master data, including
 * prices, is administrative). The initial quantity is allowed here for
 * onboarding; afterwards stock levels change ONLY via /api/inventory/stock
 * so every movement lands in the StockTransaction ledger.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = inventoryItemCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const item = await db.inventoryItem.create({
      data: {
        name: d.name,
        categoryId: d.categoryId,
        supplierId: d.supplierId || null,
        batchNumber: d.batchNumber ?? null,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
        unit: d.unit ?? null,
        quantity: d.quantity,
        minStock: d.minStock,
        purchasePrice: toPaise(d.purchasePrice),
        sellingPrice: toPaise(d.sellingPrice),
        mrp: toPaise(d.mrp),
        gst: toBps(d.gst),
        status: d.status,
      },
      include: { category: true, supplier: true },
    })
    // Initial stock onboarding is itself a stock movement — record it.
    if (d.quantity > 0) {
      await db.stockTransaction.create({
        data: {
          itemId: item.id,
          type: 'in',
          quantity: d.quantity,
          note: 'Initial stock on item creation',
        },
      })
    }
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'inventory.item.create', {
      entity: 'InventoryItem',
      entityId: item.id,
      after: { name: item.name, quantity: item.quantity, sellingPrice: d.sellingPrice },
    })
    return NextResponse.json(serializeInventoryItem(item))
  } catch (e) {
    return handleApiError(e)
  }
}
