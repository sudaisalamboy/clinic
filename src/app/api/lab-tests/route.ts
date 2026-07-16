import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession } from '@/lib/auth'

const LabTestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().min(0).default(0),
  referenceRange: z.string().max(500).optional().nullable(),
  sampleType: z.string().max(100).optional().nullable(),
  turnaroundHours: z.number().int().min(0).optional().nullable(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await extendSession(owner.autoLockMinutes)

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const category = url.searchParams.get('category')
  const status = url.searchParams.get('status') ?? 'all'

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { category: { contains: q } },
      { sampleType: { contains: q } },
    ]
  }
  if (category) where.category = category
  if (status !== 'all') where.status = status

  const labTests = await db.labTest.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { patientTests: true } } },
  })

  return NextResponse.json({ labTests })
}

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = LabTestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const labTest = await db.labTest.create({
    data: {
      name: d.name.trim(),
      category: d.category?.trim() || null,
      description: d.description?.trim() || null,
      price: d.price,
      referenceRange: d.referenceRange?.trim() || null,
      sampleType: d.sampleType?.trim() || null,
      turnaroundHours: d.turnaroundHours ?? null,
      status: d.status,
    },
    include: { _count: { select: { patientTests: true } } },
  })
  return NextResponse.json({ labTest })
}
