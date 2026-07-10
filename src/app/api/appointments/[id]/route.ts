import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  scheduledAt: z.string().optional(),
  reason: z.string().max(500).optional().nullable(),
  status: z
    .enum(['Scheduled', 'Confirmed', 'Checked-In', 'Completed', 'Cancelled', 'No Show'])
    .optional(),
  fee: z.number().min(0).optional(),
  doctorId: z.string().optional().nullable(),
  reminderSent: z.boolean().optional(),
  /// If true, skips the availability overlap check when rescheduling.
  skipConflictCheck: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const appt = await db.appointment.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, name: true, phone: true, email: true, patientCode: true,
          dateOfBirth: true, gender: true, bloodGroup: true,
        },
      },
      doctor: {
        select: { id: true, name: true, specialization: true, department: { select: { name: true } } },
      },
    },
  })
  if (!appt) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }
  // Patient's appointment history (most recent 20, excluding this one)
  const history = await db.appointment.findMany({
    where: { patientId: appt.patientId, id: { not: appt.id } },
    orderBy: { scheduledAt: 'desc' },
    take: 20,
    include: {
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })
  return NextResponse.json({ appointment: appt, history })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const data: Record<string, unknown> = {}
  if (d.reason !== undefined) data.reason = d.reason?.trim() || null
  if (d.status !== undefined) data.status = d.status
  if (d.fee !== undefined) data.fee = d.fee
  if (d.doctorId !== undefined) data.doctorId = d.doctorId || null
  if (d.reminderSent !== undefined) data.reminderSent = d.reminderSent

  if (d.scheduledAt !== undefined) {
    const dt = new Date(d.scheduledAt)
    if (isNaN(dt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 })
    }
    data.scheduledAt = dt

    // If rescheduling with a doctor, check availability
    if (!d.skipConflictCheck && (d.doctorId !== undefined || d.scheduledAt !== undefined)) {
      const existing = await db.appointment.findUnique({ where: { id }, select: { doctorId: true } })
      const effectiveDoctorId = d.doctorId !== undefined ? (d.doctorId || null) : existing?.doctorId
      if (effectiveDoctorId) {
        // Inline conflict check (exclude self)
        const windowMs = 30 * 60 * 1000
        const start = new Date(dt.getTime() - windowMs)
        const end = new Date(dt.getTime() + windowMs)
        const conflict = await db.appointment.findFirst({
          where: {
            doctorId: effectiveDoctorId,
            scheduledAt: { gte: start, lte: end },
            status: { notIn: ['Cancelled', 'No Show'] },
            id: { not: id },
          },
          include: { patient: { select: { name: true } } },
        })
        if (conflict) {
          return NextResponse.json(
            {
              error: `Doctor already has an appointment with ${conflict.patient.name} at ${conflict.scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Pick a time at least 30 minutes apart.`,
            },
            { status: 409 },
          )
        }
      }
    }
  }

  const appointment = await db.appointment.update({
    where: { id },
    data,
    include: {
      patient: { select: { id: true, name: true, phone: true, patientCode: true } },
      doctor: { select: { id: true, name: true, specialization: true, department: { select: { name: true } } } },
    },
  })
  return NextResponse.json({ appointment })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  await db.appointment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
