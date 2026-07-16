import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const PatientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(120).optional().nullable().or(z.literal('')),
  address: z.string().max(300).optional().nullable(),
  bloodGroup: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'])
    .optional()
    .nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

const PAGE_SIZE = 10

/** Generates the next patient code like PAT-2026-0001. */
async function generatePatientCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PAT-${year}-`
  // Find the highest existing sequence number for this year.
  const existing = await db.patient.findMany({
    where: { patientCode: { startsWith: prefix } },
    select: { patientCode: true },
  })
  let max = 0
  for (const p of existing) {
    const suffix = p.patientCode.slice(prefix.length)
    const n = parseInt(suffix, 10)
    if (!isNaN(n) && n > max) max = n
  }
  const next = max + 1
  return `${prefix}${next.toString().padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const status = url.searchParams.get('status') ?? 'all' // all | Active | Inactive
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.max(
    1,
    Math.min(100, parseInt(url.searchParams.get('limit') ?? String(PAGE_SIZE), 10)),
  )

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = status
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
      { patientCode: { contains: q } },
    ]
  }

  const [total, patients] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { appointments: true, bills: true } },
      },
    }),
  ])

  return NextResponse.json({
    patients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = PatientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data

  let dateOfBirth: Date | null = null
  if (d.dateOfBirth) {
    dateOfBirth = new Date(d.dateOfBirth)
    if (isNaN(dateOfBirth.getTime())) dateOfBirth = null
  }

  // Generate a unique patient code (retry on collision, very unlikely)
  let patientCode = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = await generatePatientCode()
    const exists = await db.patient.findUnique({ where: { patientCode: candidate } })
    if (!exists) {
      patientCode = candidate
      break
    }
  }
  if (!patientCode) {
    return NextResponse.json(
      { error: 'Failed to generate a unique patient code' },
      { status: 500 },
    )
  }

  const patient = await db.patient.create({
    data: {
      patientCode,
      name: d.name.trim(),
      dateOfBirth,
      gender: d.gender ?? null,
      phone: d.phone?.trim() || null,
      email: d.email?.trim() || null,
      address: d.address?.trim() || null,
      bloodGroup: d.bloodGroup ?? null,
      notes: d.notes?.trim() || null,
      status: 'Active',
    },
    include: {
      _count: { select: { appointments: true, bills: true } },
    },
  })
  return NextResponse.json({ patient })
}
