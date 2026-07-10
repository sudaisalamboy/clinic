import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const AppointmentSchema = z.object({
  patientId: z.string().min(1),
  scheduledAt: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  fee: z.number().min(0).default(0),
  doctorId: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const patientId = url.searchParams.get('patientId')
  const doctorId = url.searchParams.get('doctorId')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (patientId) where.patientId = patientId
  if (doctorId) where.doctorId = doctorId

  const appointments = await db.appointment.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    include: { patient: true, doctor: { include: { department: true } } },
    take: 200,
  })

  return NextResponse.json({ appointments })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = AppointmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const scheduledAt = new Date(d.scheduledAt)
  if (isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 })
  }
  // Ensure patient exists
  const patient = await db.patient.findUnique({ where: { id: d.patientId } })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }
  // Validate doctor if provided
  if (d.doctorId) {
    const doctor = await db.doctor.findUnique({ where: { id: d.doctorId } })
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
  }
  const appointment = await db.appointment.create({
    data: {
      patientId: d.patientId,
      doctorId: d.doctorId || null,
      scheduledAt,
      reason: d.reason?.trim() || null,
      status: d.status,
      fee: d.fee,
    },
    include: { patient: true, doctor: { include: { department: true } } },
  })
  return NextResponse.json({ appointment })
}
