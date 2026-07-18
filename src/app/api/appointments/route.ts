/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const q = searchParams.get('q')?.trim() || ''
    const where: any = {}
    if (date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      where.date = { gte: start, lte: end }
    }
    if (status && status !== 'all') {
      where.status = status
    }
    if (q) {
      where.OR = [
        { patientName: { contains: q } },
        { mobile: { contains: q } },
        { notes: { contains: q } },
      ]
    }
    const items = await db.appointment.findMany({
      where,
      include: { staff: true, consultationFee: true },
      orderBy: { date: 'asc' },
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
    let fee = Number(body.fee) || 0
    if (!fee && body.consultationFeeId) {
      const cf = await db.consultationFee.findUnique({ where: { id: body.consultationFeeId } })
      if (cf) fee = cf.fee
    }
    const item = await db.appointment.create({
      data: {
        patientName: body.patientName,
        mobile: body.mobile || null,
        staffId: body.staffId || null,
        consultationFeeId: body.consultationFeeId || null,
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type || 'Walk-in',
        fee,
        status: body.status || 'Pending',
        notes: body.notes || null,
      },
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
