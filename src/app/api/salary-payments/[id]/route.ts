/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError, notFound, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { idParamSchema } from '@/lib/api-schemas'
import { serializeSalaryPayment, toRupees } from '@/lib/money'

/**
 * DELETE /api/salary-payments/[id]
 *
 * Remove an erroneous payroll entry (e.g. wrong amount recorded). Unlike
 * bills (which are soft-voided for financial audit), a salary payment row
 * has no downstream stock/revenue effects, so a hard delete + audit log
 * entry is appropriate — the audit trail preserves the full before-state.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const exists = await db.salaryPayment.findUnique({
      where: { id },
      include: { staff: { select: { name: true } } },
    })
    if (!exists) notFound('Salary payment not found')

    await db.salaryPayment.delete({ where: { id } })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'salary.delete', {
      entity: 'SalaryPayment',
      entityId: id,
      before: {
        staff: exists.staff.name,
        amount: toRupees(exists.amount),
        month: exists.month,
        method: exists.method,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * GET /api/salary-payments/[id] — single payment (used by the UI detail view).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const payment = await db.salaryPayment.findUnique({
      where: { id },
      include: { staff: { select: { id: true, name: true, role: true } } },
    })
    if (!payment) notFound('Salary payment not found')
    return NextResponse.json(serializeSalaryPayment(payment))
  } catch (e) {
    return handleApiError(e)
  }
}
