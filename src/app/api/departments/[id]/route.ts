import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
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
  const data: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) {
    const exists = await db.department.findUnique({ where: { name: parsed.data.name } })
    if (exists && exists.id !== id) {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 400 })
    }
    data.name = parsed.data.name.trim()
  }
  if (parsed.data.description !== undefined) {
    data.description = parsed.data.description?.trim() || null
  }
  const department = await db.department.update({
    where: { id },
    data,
    include: { _count: { select: { doctors: true } } },
  })
  return NextResponse.json({ department })
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
  const dept = await db.department.findUnique({
    where: { id },
    include: { _count: { select: { doctors: true } } },
  })
  if (dept && dept._count.doctors > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${dept._count.doctors} doctor(s) are still linked to this department. Reassign them first.` },
      { status: 400 },
    )
  }
  await db.department.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
