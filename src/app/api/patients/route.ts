/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  handleApiError,
  safeJson,
  badRequest,
  parsePagination,
  listResponse,
  getClientIp,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { patientCreateSchema } from '@/lib/api-schemas'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { mobile: { contains: q } },
        { email: { contains: q } },
      ]
    }
    const { skip, take } = parsePagination(new URL(req.url))
    const [items, total] = await Promise.all([
      db.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.patient.count({ where }),
    ])
    return listResponse(items, total)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = patientCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const item = await db.patient.create({
      data: {
        name: d.name,
        mobile: d.mobile ?? null,
        email: d.email ?? null,
        address: d.address ?? null,
        gender: d.gender ?? null,
        age: d.age ?? null,
        notes: d.notes ?? null,
      },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'patient.create', {
      entity: 'Patient',
      entityId: item.id,
      after: item,
    })
    return NextResponse.json(item)
  } catch (e) {
    return handleApiError(e)
  }
}
