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
import {
  consultationFeeUpdateSchema,
  idParamSchema,
} from '@/lib/api-schemas'
import { toPaise, serializeConsultationFee, toRupees } from '@/lib/money'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = consultationFeeUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const exists = await db.consultationFee.findUnique({ where: { id } })
    if (!exists) notFound('Consultation fee not found')
    const item = await db.consultationFee.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.fee !== undefined && { fee: toPaise(d.fee) }),
        ...(d.description !== undefined && { description: d.description ?? null }),
      },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'consultation_fee.update', {
      entity: 'ConsultationFee',
      entityId: id,
      before: { name: exists.name, fee: toRupees(exists.fee) },
      after: { name: item.name, fee: toRupees(item.fee) },
    })
    return NextResponse.json(serializeConsultationFee(item))
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
    const exists = await db.consultationFee.findUnique({ where: { id } })
    if (!exists) notFound('Consultation fee not found')
    // Guard: refuse to delete a fee type still referenced by appointments —
    // deleting it would silently detach fee history from those visits.
    const inUse = await db.appointment.count({ where: { consultationFeeId: id } })
    if (inUse > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a fee type that is referenced by appointments' },
        { status: 409 },
      )
    }
    await db.consultationFee.delete({ where: { id } })
    await writeAudit({ userId: user.id, ip: getClientIp(_req) }, 'consultation_fee.delete', {
      entity: 'ConsultationFee',
      entityId: id,
      before: { name: exists.name, fee: toRupees(exists.fee) },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
