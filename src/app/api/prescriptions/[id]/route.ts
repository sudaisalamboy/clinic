import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const prescription = await db.prescription.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, name: true, patientCode: true, phone: true, email: true,
          dateOfBirth: true, gender: true, bloodGroup: true, address: true,
        },
      },
      doctor: {
        select: { id: true, name: true, specialization: true, department: { select: { name: true } } },
      },
      medicalRecord: true,
    },
  })
  if (!prescription) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
  }
  return NextResponse.json({
    prescription: {
      ...prescription,
      medicines: JSON.parse(prescription.medicines),
    },
  })
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
  // Deleting the prescription does NOT delete the medical record.
  await db.prescription.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
