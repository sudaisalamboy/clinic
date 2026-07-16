import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const MedicineEntrySchema = z.object({
  medicineId: z.string().optional().nullable(),
  name: z.string().min(1, 'Medicine name is required').max(200),
  dosage: z.string().max(100).default(''), // e.g. "1 tablet"
  frequency: z.string().max(100).default(''), // e.g. "3 times a day"
  duration: z.string().max(100).default(''), // e.g. "5 days"
  instructions: z.string().max(500).optional().nullable().default(''),
})

const PrescriptionSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  visitDate: z.string().optional(),
  // Medical record fields
  symptoms: z.string().max(2000).optional().nullable(),
  temperature: z.string().max(20).optional().nullable(),
  bloodPressure: z.string().max(20).optional().nullable(),
  pulse: z.string().max(20).optional().nullable(),
  weight: z.string().max(20).optional().nullable(),
  height: z.string().max(20).optional().nullable(),
  diagnosis: z.string().max(2000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  // Prescription fields
  medicines: z.array(MedicineEntrySchema).min(1, 'Add at least one medicine'),
  advice: z.string().max(5000).optional().nullable(),
  nextVisitDate: z.string().optional().nullable(),
})

/** Generates the next prescription number like RX-2026-0001. */
async function generatePrescriptionNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `RX-${year}-`
  const existing = await db.prescription.findMany({
    where: { prescriptionNumber: { startsWith: prefix } },
    select: { prescriptionNumber: true },
  })
  let max = 0
  for (const p of existing) {
    const n = parseInt(p.prescriptionNumber.slice(prefix.length), 10)
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
  const q = url.searchParams.get('q')?.trim() ?? ''
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') ?? '100', 10)))

  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (doctorId) where.doctorId = doctorId
  if (q) {
    where.OR = [
      { prescriptionNumber: { contains: q } },
      { patient: { name: { contains: q } } },
      { patient: { patientCode: { contains: q } } },
      { doctor: { name: { contains: q } } },
      { medicalRecord: { diagnosis: { contains: q } } },
    ]
  }

  const prescriptions = await db.prescription.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true, dateOfBirth: true, gender: true } },
      doctor: { select: { id: true, name: true, specialization: true, department: { select: { name: true } } } },
      medicalRecord: { select: { id: true, diagnosis: true, symptoms: true, visitDate: true } },
    },
  })

  return NextResponse.json({
    prescriptions: prescriptions.map((p) => ({
      ...p,
      medicines: JSON.parse(p.medicines),
    })),
  })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = PrescriptionSchema.safeParse(body)
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
  // Validate doctor
  if (d.doctorId) {
    const doctor = await db.doctor.findUnique({ where: { id: d.doctorId } })
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
  }

  // Parse visit date
  let visitDate = new Date()
  if (d.visitDate) {
    const vd = new Date(d.visitDate)
    if (!isNaN(vd.getTime())) visitDate = vd
  }

  // Parse next visit date
  let nextVisitDate: Date | null = null
  if (d.nextVisitDate) {
    nextVisitDate = new Date(d.nextVisitDate)
    if (isNaN(nextVisitDate.getTime())) nextVisitDate = null
  }

  // Generate prescription number
  let prescriptionNumber = ''
  for (let i = 0; i < 3; i++) {
    const candidate = await generatePrescriptionNumber()
    const exists = await db.prescription.findUnique({ where: { prescriptionNumber: candidate } })
    if (!exists) { prescriptionNumber = candidate; break }
  }
  if (!prescriptionNumber) {
    return NextResponse.json({ error: 'Failed to generate prescription number' }, { status: 500 })
  }

  // Create medical record + prescription in a transaction
  const [medicalRecord] = await db.$transaction([
    db.medicalRecord.create({
      data: {
        patientId: d.patientId,
        doctorId: d.doctorId || null,
        appointmentId: d.appointmentId || null,
        visitDate,
        symptoms: d.symptoms?.trim() || null,
        temperature: d.temperature?.trim() || null,
        bloodPressure: d.bloodPressure?.trim() || null,
        pulse: d.pulse?.trim() || null,
        weight: d.weight?.trim() || null,
        height: d.height?.trim() || null,
        diagnosis: d.diagnosis?.trim() || null,
        notes: d.notes?.trim() || null,
      },
    }),
  ])

  const prescription = await db.prescription.create({
    data: {
      prescriptionNumber,
      medicalRecordId: medicalRecord.id,
      patientId: d.patientId,
      doctorId: d.doctorId || null,
      medicines: JSON.stringify(d.medicines),
      advice: d.advice?.trim() || null,
      nextVisitDate,
    },
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true, dateOfBirth: true, gender: true } },
      doctor: { select: { id: true, name: true, specialization: true, department: { select: { name: true } } } },
      medicalRecord: true,
    },
  })

  // Auto-decrement medicine stock for prescribed medicines
  for (const m of d.medicines) {
    if (!m.medicineId) {
      // Try to match by name
      const med = await db.medicine.findFirst({ where: { name: { equals: m.name } } })
      if (med && med.quantity > 0) {
        const decrement = 1 // default 1 unit per prescription entry; real systems would parse duration
        await db.medicine.update({
          where: { id: med.id },
          data: { quantity: { decrement: Math.min(decrement, med.quantity) } },
        })
      }
    } else {
      const med = await db.medicine.findUnique({ where: { id: m.medicineId } })
      if (med && med.quantity > 0) {
        await db.medicine.update({
          where: { id: med.id },
          data: { quantity: { decrement: Math.min(1, med.quantity) } },
        })
      }
    }
  }

  return NextResponse.json({
    prescription: { ...prescription, medicines: JSON.parse(prescription.medicines) },
  })
}
