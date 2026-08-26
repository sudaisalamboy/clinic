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
import { patientUpdateSchema, idParamSchema } from '@/lib/api-schemas'
import { serializeBill, serializeAppointment } from '@/lib/money'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser()
    const { id } = idParamSchema.parse(await params)
    const item = await db.patient.findUnique({
      where: { id },
      include: {
        appointments: { orderBy: { date: 'desc' }, include: { staff: true } },
        bills: { orderBy: { createdAt: 'desc' }, include: { items: true } },
      },
    })
    if (!item) notFound('Patient not found')
    // Nested money rows (appointments, bills) are serialized to API units.
    return NextResponse.json({
      ...item,
      appointments: item.appointments.map(serializeAppointment),
      bills: item.bills.map(serializeBill),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = idParamSchema.parse(await params)
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = patientUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const existing = await db.patient.findUnique({ where: { id } })
    if (!existing) notFound('Patient not found')
    const item = await db.patient.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.mobile !== undefined && { mobile: d.mobile || null }),
        ...(d.email !== undefined && { email: d.email || null }),
        ...(d.address !== undefined && { address: d.address || null }),
        ...(d.gender !== undefined && { gender: d.gender || null }),
        ...(d.age !== undefined && { age: d.age }),
        ...(d.notes !== undefined && { notes: d.notes || null }),
      },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'patient.update', {
      entity: 'Patient',
      entityId: id,
      before: existing,
      after: item,
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
    const user = await requireUser()
    const { id } = idParamSchema.parse(await params)
    const existing = await db.patient.findUnique({ where: { id } })
    if (!existing) notFound('Patient not found')
    // Guard: refuse to delete a patient that still has any appointment or
    // bill attached — hard-deleting them would orphan the visit/billing
    // history (and the soft patientName on those rows would lose its
    // link). The frontend should reassign or archive instead.
    const [apptCount, billCount] = await Promise.all([
      db.appointment.count({ where: { patientId: id } }),
      db.bill.count({ where: { patientId: id } }),
    ])
    if (apptCount > 0 || billCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a patient with visit or billing history' },
        { status: 409 },
      )
    }
    await db.patient.delete({ where: { id } })
    await writeAudit({ userId: user.id, ip: getClientIp(_req) }, 'patient.delete', {
      entity: 'Patient',
      entityId: id,
      before: existing,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
