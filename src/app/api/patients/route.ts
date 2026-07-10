import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const PatientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  age: z.number().int().min(0).max(150).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(120).optional().nullable().or(z.literal('')),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      }
    : {}

  const patients = await db.patient.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { appointments: true, bills: true } },
    },
    take: 200,
  })

  return NextResponse.json({ patients })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = PatientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const patient = await db.patient.create({
    data: {
      name: d.name.trim(),
      age: d.age ?? null,
      gender: d.gender ?? null,
      phone: d.phone?.trim() || null,
      email: d.email?.trim() || null,
      address: d.address?.trim() || null,
      notes: d.notes?.trim() || null,
    },
  })
  return NextResponse.json({ patient })
}
