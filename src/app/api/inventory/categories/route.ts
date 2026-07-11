import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireUser()
    const items = await db.inventoryCategory.findMany({
      orderBy: { order: 'asc' },
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
    const max = await db.inventoryCategory.aggregate({ _max: { order: true } })
    const order = (max._max.order ?? -1) + 1
    const item = await db.inventoryCategory.create({
      data: { name: body.name, order },
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
