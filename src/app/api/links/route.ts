import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const LinkSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  url: z.string().url('Must be a valid URL'),
  category: z.string().max(60).nullable().optional(),
})

export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)
  const links = await db.link.findMany({
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ links })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const link = await db.link.create({ data: parsed.data })
  return NextResponse.json({ link })
}
