import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await params
    const body = await req.json()
    const data: any = {}
    if (body.patientName !== undefined) data.patientName = body.patientName
    if (body.mobile !== undefined) data.mobile = body.mobile
    if (body.staffId !== undefined) data.staffId = body.staffId || null
    if (body.consultationFeeId !== undefined) data.consultationFeeId = body.consultationFeeId || null
    if (body.date !== undefined) data.date = new Date(body.date)
    if (body.type !== undefined) data.type = body.type
    if (body.fee !== undefined) data.fee = Number(body.fee)
    if (body.status !== undefined) data.status = body.status
    if (body.notes !== undefined) data.notes = body.notes
    const item = await db.appointment.update({
      where: { id },
      data,
      include: { staff: true, consultationFee: true },
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
    await db.appointment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}
