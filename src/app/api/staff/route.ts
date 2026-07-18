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
    const q = searchParams.get('q')?.trim() || ''
    const role = searchParams.get('role')?.trim() || ''
    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { mobile: { contains: q } },
        { email: { contains: q } },
        { department: { contains: q } },
      ]
    }
    if (role && role !== 'all') {
      where.role = role
    }
    const items = await db.staff.findMany({
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
    const item = await db.staff.create({
      data: {
        name: body.name,
        gender: body.gender || null,
        mobile: body.mobile || null,
        email: body.email || null,
        address: body.address || null,
        photo: body.photo || null,
        role: body.role || 'Staff',
        department: body.department || null,
        salary: Number(body.salary) || 0,
        joiningDate: body.joiningDate ? new Date(body.joiningDate) : new Date(),
        status: body.status || 'Active',
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
