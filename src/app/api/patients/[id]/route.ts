import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(120).optional().nullable().or(z.literal('')),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
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
  if (d.age !== undefined) data.age = d.age
  if (d.gender !== undefined) data.gender = d.gender
  if (d.phone !== undefined) data.phone = d.phone?.trim() || null
  if (d.email !== undefined) data.email = d.email?.trim() || null
  if (d.address !== undefined) data.address = d.address?.trim() || null
  if (d.notes !== undefined) data.notes = d.notes?.trim() || null

  const patient = await db.patient.update({ where: { id }, data })
  return NextResponse.json({ patient })
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
  await db.patient.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
