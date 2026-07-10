import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const ScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM').optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM').optional().nullable(),
  isWorking: z.boolean().default(false),
})

const DoctorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  specialization: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(120).optional().nullable().or(z.literal('')),
  consultationFee: z.number().min(0).default(0),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  departmentId: z.string().optional().nullable(),
  schedule: z.array(ScheduleItemSchema).default([]),
})

const PAGE_SIZE = 10

async function generateDoctorCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `DOC-${year}-`
  const existing = await db.doctor.findMany({
    where: { doctorCode: { startsWith: prefix } },
    select: { doctorCode: true },
  })
  let max = 0
  for (const d of existing) {
    const n = parseInt(d.doctorCode.slice(prefix.length), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${prefix}${(max + 1).toString().padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const status = url.searchParams.get('status') ?? 'all'
  const departmentId = url.searchParams.get('departmentId') ?? 'all'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') ?? String(PAGE_SIZE), 10)))

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = status
  if (departmentId !== 'all') where.departmentId = departmentId
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { specialization: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
      { doctorCode: { contains: q } },
    ]
  }

  const [total, doctors] = await Promise.all([
    db.doctor.count({ where }),
    db.doctor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        department: true,
        _count: { select: { appointments: true } },
      },
    }),
  ])

  return NextResponse.json({
    doctors,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = DoctorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Validate department if provided
  if (d.departmentId) {
    const dept = await db.department.findUnique({ where: { id: d.departmentId } })
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 400 })
    }
  }

  // Generate unique doctor code
  let doctorCode = ''
  for (let i = 0; i < 3; i++) {
    const candidate = await generateDoctorCode()
    const exists = await db.doctor.findUnique({ where: { doctorCode: candidate } })
    if (!exists) { doctorCode = candidate; break }
  }
  if (!doctorCode) {
    return NextResponse.json({ error: 'Failed to generate doctor code' }, { status: 500 })
  }

  // Normalize schedule: ensure all 7 days present, working days must have start/end
  const scheduleByDay = new Map<number, z.infer<typeof ScheduleItemSchema>>()
  for (const s of d.schedule) scheduleByDay.set(s.dayOfWeek, s)
  const finalSchedule: { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean }[] = []
  for (let day = 0; day < 7; day++) {
    const s = scheduleByDay.get(day)
    if (s && s.isWorking && s.startTime && s.endTime) {
      finalSchedule.push({
        dayOfWeek: day,
        startTime: s.startTime,
        endTime: s.endTime,
        isWorking: true,
      })
    } else {
      finalSchedule.push({
        dayOfWeek: day,
        startTime: s?.startTime ?? '09:00',
        endTime: s?.endTime ?? '17:00',
        isWorking: false,
      })
    }
  }

  const doctor = await db.doctor.create({
    data: {
      doctorCode,
      name: d.name.trim(),
      specialization: d.specialization?.trim() || null,
      phone: d.phone?.trim() || null,
      email: d.email?.trim() || null,
      consultationFee: d.consultationFee,
      status: d.status,
      departmentId: d.departmentId || null,
      schedule: { create: finalSchedule },
    },
    include: {
      department: true,
      schedule: { orderBy: { dayOfWeek: 'asc' } },
      _count: { select: { appointments: true } },
    },
  })

  return NextResponse.json({ doctor })
}
