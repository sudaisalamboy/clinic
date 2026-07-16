import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(20000).optional(),
  pinned: z.boolean().optional(),
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
  const parsed = UpdateNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const note = await db.note.update({
    where: { id },
    data: parsed.data,
  })
  return NextResponse.json({ note })
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
  await db.note.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
