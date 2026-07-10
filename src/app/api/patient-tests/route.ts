import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const AssignSchema = z.object({
  patientId: z.string().min(1),
  labTestId: z.string().min(1),
  doctorId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
})

/** Generates the next test number like LT-2026-0001. */
async function generateTestNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `LT-${year}-`
  const existing = await db.patientLabTest.findMany({
    where: { testNumber: { startsWith: prefix } },
    select: { testNumber: true },
  })
  let max = 0
  for (const t of existing) {
    const n = parseInt(t.testNumber.slice(prefix.length), 10)
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
  const patientId = url.searchParams.get('patientId')
  const doctorId = url.searchParams.get('doctorId')
  const status = url.searchParams.get('status')
  const labTestId = url.searchParams.get('labTestId')
  const q = url.searchParams.get('q')?.trim() ?? ''
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') ?? '100', 10)))

  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (doctorId) where.doctorId = doctorId
  if (status) where.status = status
  if (labTestId) where.labTestId = labTestId
  if (q) {
    where.OR = [
      { testNumber: { contains: q } },
      { patient: { name: { contains: q } } },
      { patient: { patientCode: { contains: q } } },
      { labTest: { name: { contains: q } } },
    ]
  }

  const patientTests = await db.patientLabTest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true, dateOfBirth: true, gender: true } },
      labTest: { select: { id: true, name: true, category: true, price: true, referenceRange: true, sampleType: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  return NextResponse.json({
    patientTests: patientTests.map((t) => ({
      ...t,
      resultValues: JSON.parse(t.resultValues),
    })),
  })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Validate patient
  const patient = await db.patient.findUnique({ where: { id: d.patientId } })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }
  // Validate lab test
  const labTest = await db.labTest.findUnique({ where: { id: d.labTestId } })
  if (!labTest) {
    return NextResponse.json({ error: 'Lab test not found' }, { status: 404 })
  }
  if (labTest.status === 'Inactive') {
    return NextResponse.json({ error: 'This lab test is Inactive' }, { status: 400 })
  }
  // Validate doctor
  if (d.doctorId) {
    const doctor = await db.doctor.findUnique({ where: { id: d.doctorId } })
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
  }

  // Generate test number
  let testNumber = ''
  for (let i = 0; i < 3; i++) {
    const candidate = await generateTestNumber()
    const exists = await db.patientLabTest.findUnique({ where: { testNumber: candidate } })
    if (!exists) { testNumber = candidate; break }
  }
  if (!testNumber) {
    return NextResponse.json({ error: 'Failed to generate test number' }, { status: 500 })
  }

  const patientTest = await db.patientLabTest.create({
    data: {
      testNumber,
      patientId: d.patientId,
      labTestId: d.labTestId,
      doctorId: d.doctorId || null,
      appointmentId: d.appointmentId || null,
      status: 'Pending',
    },
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true, dateOfBirth: true, gender: true } },
      labTest: { select: { id: true, name: true, category: true, price: true, referenceRange: true, sampleType: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  return NextResponse.json({
    patientTest: { ...patientTest, resultValues: JSON.parse(patientTest.resultValues) },
  })
}
