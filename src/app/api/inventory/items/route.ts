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
    const category = searchParams.get('category')?.trim() || ''
    const filter = searchParams.get('filter')?.trim() || ''
    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { batchNumber: { contains: q } },
      ]
    }
    if (category && category !== 'all') {
      where.categoryId = category
    }
    if (filter === 'low') {
      // stock below min
      where.quantity = { lte: 0 }
      // we'll refine with raw filter below
    }
    const items = await db.inventoryItem.findMany({
      where,
      include: { category: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    })

    const now = new Date()
    const within30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let result = items
    if (filter === 'low') {
      result = items.filter((i) => i.quantity <= i.minStock)
    } else if (filter === 'expiring') {
      result = items.filter(
        (i) => i.expiryDate && i.expiryDate <= within30 && i.expiryDate >= now,
      )
    } else if (filter === 'expired') {
      result = items.filter((i) => i.expiryDate && i.expiryDate < now)
    }

    return NextResponse.json(result)
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
    const item = await db.inventoryItem.create({
      data: {
        name: body.name,
        categoryId: body.categoryId,
        supplierId: body.supplierId || null,
        batchNumber: body.batchNumber || null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        unit: body.unit || null,
        quantity: Number(body.quantity) || 0,
        minStock: Number(body.minStock) || 0,
        purchasePrice: Number(body.purchasePrice) || 0,
        sellingPrice: Number(body.sellingPrice) || 0,
        mrp: Number(body.mrp) || 0,
        gst: Number(body.gst) || 0,
        status: body.status || 'Active',
      },
      include: { category: true, supplier: true },
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
