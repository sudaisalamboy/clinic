import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const UpdateSchema = z.object({
  scheduledAt: z.string().optional(),
  reason: z.string().max(500).optional().nullable(),
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  fee: z.number().min(0).optional(),
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
  if (d.scheduledAt !== undefined) {
    const dt = new Date(d.scheduledAt)
    if (isNaN(dt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 })
    }
    data.scheduledAt = dt
  }
  if (d.reason !== undefined) data.reason = d.reason?.trim() || null
  if (d.status !== undefined) data.status = d.status
  if (d.fee !== undefined) data.fee = d.fee

  const appointment = await db.appointment.update({
    where: { id },
    data,
    include: { patient: true },
  })
  return NextResponse.json({ appointment })
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
  await db.appointment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
