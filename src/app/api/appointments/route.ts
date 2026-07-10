import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const AppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional().nullable(),
  scheduledAt: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
  status: z
    .enum(['Scheduled', 'Confirmed', 'Checked-In', 'Completed', 'Cancelled', 'No Show'])
    .default('Scheduled'),
  fee: z.number().min(0).default(0),
  /// If true, skips the availability overlap check (used for migration/overrides).
  skipConflictCheck: z.boolean().optional(),
})

const STATUS_FLOW = ['Scheduled', 'Confirmed', 'Checked-In', 'Completed'] as const
const ALL_STATUSES = [...STATUS_FLOW, 'Cancelled', 'No Show'] as const

/** Returns the day-of-week (0=Sun...6=Sat) from a Date in local time. */
function dayOfWeek(d: Date): number {
  return d.getDay()
}

/** Generates the next daily token for a given doctor on a given date.
 *  Format: A-001, A-002, ... per doctor per day. */
async function generateToken(doctorId: string | null, date: Date): Promise<string> {
  const prefix = 'A-'
  // Window: start-of-day to end-of-day for the given date (local time)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const where = {
    scheduledAt: { gte: start, lte: end },
    status: { notIn: ['Cancelled'] },
    ...(doctorId ? { doctorId } : {}),
  }
  const count = await db.appointment.count({ where })
  // Next sequence = existing count + 1 (capped at 999)
  const seq = Math.min(count + 1, 999)
  return `${prefix}${seq.toString().padStart(3, '0')}`
}

/** Checks whether the given doctor is already booked within ±30 min of the target time. */
async function findConflict(
  doctorId: string | null,
  when: Date,
  excludeId?: string,
): Promise<{ id: string; patientName: string; scheduledAt: Date } | null> {
  if (!doctorId) return null
  const windowMs = 30 * 60 * 1000 // 30 minutes on each side
  const start = new Date(when.getTime() - windowMs)
  const end = new Date(when.getTime() + windowMs)
  const conflict = await db.appointment.findFirst({
    where: {
      doctorId,
      scheduledAt: { gte: start, lte: end },
      status: { notIn: ['Cancelled', 'No Show'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { patient: { select: { name: true } } },
  })
  if (!conflict) return null
  return {
    id: conflict.id,
    patientName: conflict.patient.name,
    scheduledAt: conflict.scheduledAt,
  }
}

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
  // Range query for calendar
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (patientId) where.patientId = patientId
  if (doctorId) where.doctorId = doctorId
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.gte = new Date(from)
    if (to) range.lte = new Date(to)
    where.scheduledAt = range
  }

  const appointments = await db.appointment.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    include: {
      patient: { select: { id: true, name: true, phone: true, patientCode: true } },
      doctor: { select: { id: true, name: true, specialization: true, department: { select: { name: true } } } },
    },
    take: 500,
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

  // Validate patient exists
  const patient = await db.patient.findUnique({ where: { id: d.patientId } })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // Validate doctor (if provided)
  let doctor: { id: string; name: string; consultationFee: number; schedule: { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean }[] } | null = null
  if (d.doctorId) {
    doctor = await db.doctor.findUnique({
      where: { id: d.doctorId },
      include: { schedule: true },
    })
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
    if (doctor.status === 'Inactive') {
      return NextResponse.json({ error: 'This doctor is currently Inactive' }, { status: 400 })
    }

    // Check doctor's working hours for that day-of-week
    const dow = dayOfWeek(scheduledAt)
    const slot = doctor.schedule.find((s) => s.dayOfWeek === dow)
    if (!slot || !slot.isWorking) {
      return NextResponse.json(
        { error: `Doctor is not scheduled to work on this day.` },
        { status: 400 },
      )
    }
    // Compare times (scheduledAt local HH:MM must be within slot start-end)
    const hh = scheduledAt.getHours().toString().padStart(2, '0')
    const mm = scheduledAt.getMinutes().toString().padStart(2, '0')
    const apptTime = `${hh}:${mm}`
    if (apptTime < slot.startTime || apptTime >= slot.endTime) {
      return NextResponse.json(
        { error: `Doctor works ${slot.startTime}–${slot.endTime} that day. Pick a time in range.` },
        { status: 400 },
      )
    }
  }

  // Check for double-booking (unless explicitly skipped)
  if (!d.skipConflictCheck && d.doctorId) {
    const conflict = await findConflict(d.doctorId, scheduledAt)
    if (conflict) {
      return NextResponse.json(
        {
          error: `Doctor already has an appointment with ${conflict.patientName} at ${conflict.scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Pick a time at least 30 minutes apart.`,
        },
        { status: 409 },
      )
    }
  }

  // Generate daily token number
  const tokenNumber = await generateToken(d.doctorId ?? null, scheduledAt)

  // Use doctor's consultationFee if fee not explicitly provided
  const fee = d.fee || doctor?.consultationFee || 0

  const appointment = await db.appointment.create({
    data: {
      patientId: d.patientId,
      doctorId: d.doctorId || null,
      scheduledAt,
      reason: d.reason?.trim() || null,
      status: d.status,
      fee,
      tokenNumber,
    },
    include: {
      patient: { select: { id: true, name: true, phone: true, patientCode: true } },
      doctor: { select: { id: true, name: true, specialization: true, department: { select: { name: true } } } },
    },
  })
  return NextResponse.json({ appointment })
}
