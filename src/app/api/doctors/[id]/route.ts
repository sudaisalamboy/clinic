import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const ScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  isWorking: z.boolean().default(false),
})

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  specialization: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(120).optional().nullable().or(z.literal('')),
  consultationFee: z.number().min(0).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  departmentId: z.string().optional().nullable(),
  schedule: z.array(ScheduleItemSchema).optional(),
  hardDelete: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const url = new URL(req.url)
  const apptLimit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('apptLimit') ?? '50', 10)))

  const doctor = await db.doctor.findUnique({
    where: { id },
    include: {
      department: true,
      schedule: { orderBy: { dayOfWeek: 'asc' } },
      appointments: {
        orderBy: { scheduledAt: 'desc' },
        take: apptLimit,
        include: { patient: true },
      },
      _count: { select: { appointments: true } },
    },
  })
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  // Split appointments: today's vs recent (past)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const todaysAppointments = doctor.appointments
    .filter((a) => a.scheduledAt >= startOfToday && a.scheduledAt <= endOfToday)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

  const recentAppointments = doctor.appointments
    .filter((a) => a.scheduledAt < startOfToday)
    .slice(0, 20)

  const upcomingAppointments = doctor.appointments
    .filter((a) => a.scheduledAt > endOfToday && a.status === 'pending')
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 10)

  return NextResponse.json({
    doctor,
    todaysAppointments,
    recentAppointments,
    upcomingAppointments,
  })
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

  if (d.hardDelete) {
    await db.doctor.delete({ where: { id } })
    return NextResponse.json({ ok: true, hardDelete: true })
  }

  if (d.departmentId !== undefined && d.departmentId) {
    const dept = await db.department.findUnique({ where: { id: d.departmentId } })
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 400 })
    }
  }

  const data: Record<string, unknown> = {}
  if (d.name !== undefined) data.name = d.name.trim()
  if (d.specialization !== undefined) data.specialization = d.specialization?.trim() || null
  if (d.phone !== undefined) data.phone = d.phone?.trim() || null
  if (d.email !== undefined) data.email = d.email?.trim() || null
  if (d.consultationFee !== undefined) data.consultationFee = d.consultationFee
  if (d.status !== undefined) data.status = d.status
  if (d.departmentId !== undefined) data.departmentId = d.departmentId || null

  // Update schedule if provided
  if (d.schedule !== undefined) {
    const scheduleByDay = new Map<number, z.infer<typeof ScheduleItemSchema>>()
    for (const s of d.schedule) scheduleByDay.set(s.dayOfWeek, s)
    // Delete existing schedule and recreate
    await db.doctorSchedule.deleteMany({ where: { doctorId: id } })
    const finalSchedule: { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean; doctorId: string }[] = []
    for (let day = 0; day < 7; day++) {
      const s = scheduleByDay.get(day)
      if (s && s.isWorking && s.startTime && s.endTime) {
        finalSchedule.push({
          doctorId: id,
          dayOfWeek: day,
          startTime: s.startTime,
          endTime: s.endTime,
          isWorking: true,
        })
      } else {
        finalSchedule.push({
          doctorId: id,
          dayOfWeek: day,
          startTime: s?.startTime ?? '09:00',
          endTime: s?.endTime ?? '17:00',
          isWorking: false,
        })
      }
    }
    await db.doctorSchedule.createMany({ data: finalSchedule })
  }

  const doctor = await db.doctor.update({
    where: { id },
    data,
    include: {
      department: true,
      schedule: { orderBy: { dayOfWeek: 'asc' } },
      _count: { select: { appointments: true } },
    },
  })
  return NextResponse.json({ doctor })
}

// DELETE — soft delete (set status to Inactive)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const doctor = await db.doctor.update({
    where: { id },
    data: { status: 'Inactive' },
    select: { id: true, status: true, name: true },
  })
  return NextResponse.json({ ok: true, doctor })
}
