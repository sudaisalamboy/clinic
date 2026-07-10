import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
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
  status: z.enum(['Active', 'Inactive']).optional(),
  /// When true, performs a HARD delete (remove the row). Used by the
  /// "Delete permanently" action. Plain DELETE = soft delete.
  hardDelete: z.boolean().optional(),
})

// GET — patient profile with full medical history (appointments + bills)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { scheduledAt: 'desc' },
        include: { bill: true },
      },
      bills: {
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { appointments: true, bills: true } },
    },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // Parse bill items JSON for the client
  const bills = patient.bills.map((b) => ({
    ...b,
    items: JSON.parse(b.items),
  }))

  return NextResponse.json({
    patient: {
      ...patient,
      bills,
    },
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

  // Hard delete via PUT to avoid changing DELETE semantics.
  if (d.hardDelete) {
    await db.patient.delete({ where: { id } })
    return NextResponse.json({ ok: true, hardDelete: true })
  }

  const data: Record<string, unknown> = {}
  if (d.name !== undefined) data.name = d.name.trim()
  if (d.dateOfBirth !== undefined) {
    data.dateOfBirth = d.dateOfBirth ? new Date(d.dateOfBirth) : null
  }
  if (d.gender !== undefined) data.gender = d.gender
  if (d.phone !== undefined) data.phone = d.phone?.trim() || null
  if (d.email !== undefined) data.email = d.email?.trim() || null
  if (d.address !== undefined) data.address = d.address?.trim() || null
  if (d.bloodGroup !== undefined) data.bloodGroup = d.bloodGroup
  if (d.notes !== undefined) data.notes = d.notes?.trim() || null
  if (d.status !== undefined) data.status = d.status

  const patient = await db.patient.update({
    where: { id },
    data,
    include: {
      _count: { select: { appointments: true, bills: true } },
    },
  })
  return NextResponse.json({ patient })
}

// DELETE — soft delete (set status to Inactive). Use PUT with hardDelete:true
// to permanently remove.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const patient = await db.patient.update({
    where: { id },
    data: { status: 'Inactive' },
    select: { id: true, status: true, name: true },
  })
  return NextResponse.json({ ok: true, patient })
}
