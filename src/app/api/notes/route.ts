import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const NoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().max(20000).default(''),
  pinned: z.boolean().default(false),
})

export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)
  const notes = await db.note.findMany({
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = NoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const note = await db.note.create({ data: parsed.data })
  return NextResponse.json({ note })
}
