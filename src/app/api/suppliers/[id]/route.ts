/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError, safeJson, badRequest, notFound, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { supplierUpdateSchema, idParamSchema } from '@/lib/api-schemas'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = supplierUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const exists = await db.supplier.findUnique({ where: { id } })
    if (!exists) notFound('Supplier not found')
    const item = await db.supplier.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.mobile !== undefined && { mobile: d.mobile || null }),
        ...(d.email !== undefined && { email: d.email || null }),
        ...(d.address !== undefined && { address: d.address || null }),
        ...(d.photo !== undefined && { photo: d.photo || null }),
        ...(d.supplies !== undefined && { supplies: d.supplies || null }),
        ...(d.notes !== undefined && { notes: d.notes || null }),
      },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'supplier.update', {
      entity: 'Supplier',
      entityId: id,
      before: { name: exists.name, mobile: exists.mobile },
      after: { name: item.name, mobile: item.mobile },
    })
    return NextResponse.json(item)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const exists = await db.supplier.findUnique({ where: { id } })
    if (!exists) notFound('Supplier not found')
    await db.supplier.delete({ where: { id } })
    await writeAudit({ userId: user.id, ip: getClientIp(_req) }, 'supplier.delete', {
      entity: 'Supplier',
      entityId: id,
      before: { name: exists.name },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
