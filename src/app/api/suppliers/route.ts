import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { mobile: { contains: q } },
        { email: { contains: q } },
        { supplies: { contains: q } },
      ]
    }
    const items = await db.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    const item = await db.supplier.create({
      data: {
        name: body.name,
        mobile: body.mobile || null,
        email: body.email || null,
        address: body.address || null,
        photo: body.photo || null,
        supplies: body.supplies || null,
        notes: body.notes || null,
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
