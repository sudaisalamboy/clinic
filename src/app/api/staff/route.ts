/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser, requireAdmin } from '@/lib/auth'
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
import { staffCreateSchema } from '@/lib/api-schemas'
import { toPaise, serializeStaff } from '@/lib/money'

export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const role = searchParams.get('role')?.trim() || ''
    const where: Record<string, unknown> = {}
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
    const { skip, take } = parsePagination(new URL(req.url))
    const [items, total] = await Promise.all([
      db.staff.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.staff.count({ where }),
    ])
    return listResponse(items.map(serializeStaff), total)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = staffCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const item = await db.staff.create({
      data: {
        name: d.name,
        gender: d.gender ?? null,
        mobile: d.mobile ?? null,
        email: d.email ?? null,
        address: d.address ?? null,
        photo: d.photo ?? null,
        role: d.role,
        department: d.department ?? null,
        salary: toPaise(d.salary),
        joiningDate: d.joiningDate ? new Date(d.joiningDate) : new Date(),
        status: d.status,
      },
    })
    // Staff creation is a sensitive mutation (role assignment) — audit it,
    // consistently with PUT/DELETE.
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'staff.create', {
      entity: 'Staff',
      entityId: item.id,
      after: { name: item.name, role: item.role, status: item.status },
    })
    return NextResponse.json(serializeStaff(item))
  } catch (e) {
    return handleApiError(e)
  }
}
