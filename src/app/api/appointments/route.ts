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
  parsePagination,
  listResponse,
  getClientIp,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { appointmentCreateSchema } from '@/lib/api-schemas'
import { getSettings } from '@/lib/settings'
import { toPaise, serializeAppointment } from '@/lib/money'
import { isValidTimeZone, zonedDayStart, zonedDayEnd } from '@/lib/time'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const q = searchParams.get('q')?.trim() || ''
    const where: Record<string, unknown> = {}
    if (date) {
      // "That calendar day" is resolved in the CLINIC's timezone, not the
      // server's — a UTC server would otherwise shift day boundaries by
      // 5½ hours for an Indian clinic.
      const settings = await getSettings()
      const tz = isValidTimeZone(settings.timezone) ? settings.timezone : 'UTC'
      where.date = { gte: zonedDayStart(date, tz), lte: zonedDayEnd(date, tz) }
    }
    if (status && status !== 'all') {
      where.status = status
    }
    if (q) {
      where.OR = [
        { patientName: { contains: q } },
        { mobile: { contains: q } },
        { notes: { contains: q } },
      ]
    }
    const { skip, take } = parsePagination(new URL(req.url))
    const [items, total] = await Promise.all([
      db.appointment.findMany({
        where,
        include: { staff: true, consultationFee: true },
        orderBy: { date: 'asc' },
        skip,
        take,
      }),
      db.appointment.count({ where }),
    ])
    return listResponse(items.map(serializeAppointment), total)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = appointmentCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    // Referential checks with friendly messages (rather than surfacing a
    // raw Prisma P2003 as a 500).
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

    let feePaise = toPaise(d.fee)
    if (feePaise === 0 && d.consultationFeeId) {
      const cf = await db.consultationFee.findUnique({
        where: { id: d.consultationFeeId },
      })
      if (cf) feePaise = cf.fee
    }

    const item = await db.appointment.create({
      data: {
        patientName: d.patientName,
        patientId: d.patientId || null,
        mobile: d.mobile ?? null,
        staffId: d.staffId || null,
        consultationFeeId: d.consultationFeeId || null,
        date: d.date ? new Date(d.date) : new Date(),
        type: d.type,
        fee: feePaise,
        status: d.status,
        notes: d.notes ?? null,
      },
      include: { staff: true, consultationFee: true },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'appointment.create', {
      entity: 'Appointment',
      entityId: item.id,
      after: { patientName: item.patientName, date: item.date, status: item.status },
    })
    return NextResponse.json(serializeAppointment(item))
  } catch (e) {
    return handleApiError(e)
  }
}
