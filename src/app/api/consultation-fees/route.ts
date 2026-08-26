/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError, safeJson, badRequest, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { consultationFeeCreateSchema } from '@/lib/api-schemas'
import { toPaise, serializeConsultationFee } from '@/lib/money'

export async function GET() {
  try {
    await requireUser()
    const items = await db.consultationFee.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(items.map(serializeConsultationFee))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = consultationFeeCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const item = await db.consultationFee.create({
      data: {
        name: d.name,
        fee: toPaise(d.fee),
        description: d.description ?? null,
      },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'consultation_fee.create', {
      entity: 'ConsultationFee',
      entityId: item.id,
      after: { name: item.name, fee: d.fee },
    })
    return NextResponse.json(serializeConsultationFee(item))
  } catch (e) {
    return handleApiError(e)
  }
}
