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
  getClientIp,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { appointmentUpdateSchema, idParamSchema } from '@/lib/api-schemas'
import { toPaise, serializeAppointment } from '@/lib/money'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = idParamSchema.parse(await params)
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = appointmentUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const exists = await db.appointment.findUnique({ where: { id } })
    if (!exists) notFound('Appointment not found')

    // Friendly referential validation (a stale staff/fee/patient id in the
    // form should be a 400, not a raw Prisma FK error).
    if (d.staffId) {
      const staff = await db.staff.findUnique({ where: { id: d.staffId } })
      if (!staff) badRequest('Selected doctor/staff does not exist')
    }
    if (d.consultationFeeId) {
      const fee = await db.consultationFee.findUnique({ where: { id: d.consultationFeeId } })
      if (!fee) badRequest('Selected consultation fee does not exist')
    }
    if (d.patientId) {
      const patient = await db.patient.findUnique({ where: { id: d.patientId } })
      if (!patient) badRequest('Selected patient does not exist')
    }

    const updateData: Record<string, unknown> = {}
    if (d.patientName !== undefined) updateData.patientName = d.patientName
    if (d.patientId !== undefined) updateData.patientId = d.patientId || null
    if (d.mobile !== undefined) updateData.mobile = d.mobile
    if (d.staffId !== undefined) updateData.staffId = d.staffId || null
    if (d.consultationFeeId !== undefined) updateData.consultationFeeId = d.consultationFeeId || null
    if (d.date !== undefined) updateData.date = new Date(d.date)
    if (d.type !== undefined) updateData.type = d.type
    if (d.fee !== undefined) updateData.fee = toPaise(d.fee)
    if (d.status !== undefined) {
      updateData.status = d.status
      // Track when the appointment was cancelled (soft-cancel marker).
      updateData.cancelledAt = d.status === 'Cancelled' ? new Date() : null
    }
    if (d.notes !== undefined) updateData.notes = d.notes

    const item = await db.appointment.update({
      where: { id },
      data: updateData,
      include: { staff: true, consultationFee: true },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'appointment.update', {
      entity: 'Appointment',
      entityId: id,
      before: { status: exists.status, date: exists.date, patientName: exists.patientName },
      after: { status: item.status, date: item.date, patientName: item.patientName },
    })
    return NextResponse.json(serializeAppointment(item))
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Cancel an appointment — a SOFT state change, never a hard delete.
 *
 * Hard-deleting would sever the appointment's link to any bill created
 * from it (Appointment.bill with onDelete: SetNull), breaking the visit
 * history. Cancelling keeps the record and stamps `cancelledAt`.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = idParamSchema.parse(await params)
    const exists = await db.appointment.findUnique({ where: { id } })
    if (!exists) notFound('Appointment not found')
    if (exists.status === 'Cancelled') badRequest('Appointment is already cancelled')

    const item = await db.appointment.update({
      where: { id },
      data: { status: 'Cancelled', cancelledAt: new Date() },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(_req) }, 'appointment.cancel', {
      entity: 'Appointment',
      entityId: id,
      before: { status: exists.status, patientName: exists.patientName },
      after: { status: item.status, cancelledAt: item.cancelledAt },
    })
    return NextResponse.json({ ok: true, cancelled: true })
  } catch (e) {
    return handleApiError(e)
  }
}
