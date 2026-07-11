import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const body = await req.json()
    const item = await db.consultationFee.update({
      where: { id },
      data: {
        name: body.name,
        fee: body.fee !== undefined ? Number(body.fee) : undefined,
        description: body.description ?? null,
      },
    })
    return NextResponse.json(item)
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    await db.consultationFee.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
