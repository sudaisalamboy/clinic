import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireUser()
    const items = await db.consultationFee.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(items)
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    await requireUser()
    const body = await req.json()
    const item = await db.consultationFee.create({
      data: {
        name: body.name,
        fee: Number(body.fee) || 0,
        description: body.description || null,
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
