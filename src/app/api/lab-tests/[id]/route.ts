import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().min(0).optional(),
  referenceRange: z.string().max(500).optional().nullable(),
  sampleType: z.string().max(100).optional().nullable(),
  turnaroundHours: z.number().int().min(0).optional().nullable(),
  status: z.enum(['Active', 'Inactive']).optional(),
})

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
  if (d.name !== undefined) data.name = d.name.trim()
  if (d.category !== undefined) data.category = d.category?.trim() || null
  if (d.description !== undefined) data.description = d.description?.trim() || null
  if (d.price !== undefined) data.price = d.price
  if (d.referenceRange !== undefined) data.referenceRange = d.referenceRange?.trim() || null
  if (d.sampleType !== undefined) data.sampleType = d.sampleType?.trim() || null
  if (d.turnaroundHours !== undefined) data.turnaroundHours = d.turnaroundHours ?? null
  if (d.status !== undefined) data.status = d.status

  const labTest = await db.labTest.update({
    where: { id },
    data,
    include: { _count: { select: { patientTests: true } } },
  })
  return NextResponse.json({ labTest })
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
  // Check if any patient tests reference this lab test
  const count = await db.patientLabTest.count({ where: { labTestId: id } })
  if (count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} patient test(s) reference this lab test. Deactivate it instead.` },
      { status: 400 },
    )
  }
  await db.labTest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
