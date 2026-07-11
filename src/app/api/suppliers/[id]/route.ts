import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const body = await req.json()
    const item = await db.supplier.update({
      where: { id },
      data: {
        name: body.name,
        mobile: body.mobile ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        photo: body.photo ?? null,
        supplies: body.supplies ?? null,
        notes: body.notes ?? null,
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
    await db.supplier.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
