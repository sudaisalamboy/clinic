import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const DeptSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  description: z.string().max(500).optional().nullable(),
})

export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)
  const departments = await db.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { doctors: true } } },
  })
  return NextResponse.json({ departments })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = DeptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const exists = await db.department.findUnique({ where: { name: parsed.data.name.trim() } })
  if (exists) {
    return NextResponse.json({ error: 'Department already exists' }, { status: 400 })
  }
  const department = await db.department.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
    },
    include: { _count: { select: { doctors: true } } },
  })
  return NextResponse.json({ department })
}
