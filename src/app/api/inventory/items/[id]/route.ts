/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError, safeJson, badRequest, notFound, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import {
  inventoryItemUpdateSchema,
  idParamSchema,
} from '@/lib/api-schemas'
import { toPaise, toBps, toRupees, serializeInventoryItem } from '@/lib/money'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser()
    const { id } = idParamSchema.parse(await params)
    const item = await db.inventoryItem.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!item) notFound('Item not found')
    return NextResponse.json({
      ...serializeInventoryItem(item),
      transactions: item.transactions,
    })
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Update an inventory item (Admin only). The `quantity` field is
 * intentionally NOT updatable here — stock levels may only change through
 * /api/inventory/stock, which records a StockTransaction row. Editing the
 * quantity in place would silently bypass the stock ledger and destroy the
 * audit trail.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = inventoryItemUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const exists = await db.inventoryItem.findUnique({ where: { id } })
    if (!exists) notFound('Item not found')
    const item = await db.inventoryItem.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.categoryId !== undefined && { categoryId: d.categoryId }),
        ...(d.supplierId !== undefined && { supplierId: d.supplierId || null }),
        ...(d.batchNumber !== undefined && { batchNumber: d.batchNumber ?? null }),
        ...(d.expiryDate !== undefined && {
          expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
        }),
        ...(d.unit !== undefined && { unit: d.unit ?? null }),
        ...(d.minStock !== undefined && { minStock: d.minStock }),
        ...(d.purchasePrice !== undefined && { purchasePrice: toPaise(d.purchasePrice) }),
        ...(d.sellingPrice !== undefined && { sellingPrice: toPaise(d.sellingPrice) }),
        ...(d.mrp !== undefined && { mrp: toPaise(d.mrp) }),
        ...(d.gst !== undefined && { gst: toBps(d.gst) }),
        ...(d.status !== undefined && { status: d.status }),
      },
      include: { category: true, supplier: true },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'inventory.item.update', {
      entity: 'InventoryItem',
      entityId: id,
      before: {
        name: exists.name,
        sellingPrice: toRupees(exists.sellingPrice),
        status: exists.status,
        minStock: exists.minStock,
      },
      after: {
        name: item.name,
        sellingPrice: d.sellingPrice ?? toRupees(exists.sellingPrice),
        status: item.status,
        minStock: item.minStock,
      },
    })
    return NextResponse.json(serializeInventoryItem(item))
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Deactivate an inventory item (Admin only) — a SOFT delete.
 *
 * Hard-deleting would CASCADE-delete every StockTransaction row for the
 * item (schema: StockTransaction.item onDelete: Cascade), permanently
 * destroying the stock ledger. Deactivation preserves all history while
 * removing the item from active billing/filtering.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const exists = await db.inventoryItem.findUnique({ where: { id } })
    if (!exists) notFound('Item not found')
    if (exists.status === 'Inactive') badRequest('Item is already inactive')
    const item = await db.inventoryItem.update({
      where: { id },
      data: { status: 'Inactive' },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(_req) }, 'inventory.item.soft_delete', {
      entity: 'InventoryItem',
      entityId: id,
      after: { id: item.id, name: item.name, status: item.status },
    })
    return NextResponse.json({ ok: true, softDeleted: true })
  } catch (e) {
    return handleApiError(e)
  }
}
