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
  notFound,
  conflict,
  parsePagination,
  listResponse,
  getClientIp,
  prismaErrorCode,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { salaryPaymentCreateSchema } from '@/lib/api-schemas'
import { toPaise, serializeSalaryPayment } from '@/lib/money'

/**
 * GET /api/salary-payments
 *
 * List payroll history. Filters:
 *  - ?staffId=<id>   → payments for one staff member
 *  - ?month=YYYY-MM  → payments for one salary period
 *
 * Each row includes the staff name (joined) so the UI can render the
 * payroll ledger without a second round-trip.
 */
export async function GET(req: Request) {
  try {
    await requireUser()
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staffId')?.trim() || ''
    const month = searchParams.get('month')?.trim() || ''

    const where: Record<string, unknown> = {}
    if (staffId) where.staffId = staffId
    // Reject a malformed month early instead of silently returning "all".
    if (month && !/^\d{4}-\d{2}$/.test(month)) badRequest('Month must be YYYY-MM')
    if (month) where.month = month

    const { skip, take } = parsePagination(new URL(req.url))
    const [items, total] = await Promise.all([
      db.salaryPayment.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: { staff: { select: { id: true, name: true, role: true } } },
      }),
      db.salaryPayment.count({ where }),
    ])
    return listResponse(items.map(serializeSalaryPayment), total)
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * POST /api/salary-payments
 *
 * Record a salary payment ("give salary"). Admin-only — payroll is a
 * financial mutation, consistent with bills/inventory mutations.
 *
 * Double-pay guard: the @@unique([staffId, month]) constraint means two
 * concurrent payments for the same staff+month can never both land. The
 * loser receives a clean 409 instead of silently double-crediting.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = salaryPaymentCreateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    // Staff must exist AND accepting payments for a soft-deleted (banned)
    // staff member would corrupt payroll history — reject explicitly.
    const staff = await db.staff.findUnique({ where: { id: d.staffId } })
    if (!staff) notFound('Staff member not found')
    if (staff.status !== 'Active') badRequest('This staff member is inactive and cannot be paid a salary')

    try {
      const payment = await db.salaryPayment.create({
        data: {
          staffId: d.staffId,
          amount: toPaise(d.amount),
          month: d.month,
          method: d.method,
          note: d.note ?? null,
        },
        include: { staff: { select: { id: true, name: true, role: true } } },
      })
      await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'salary.pay', {
        entity: 'SalaryPayment',
        entityId: payment.id,
        after: {
          staff: staff.name,
          amount: d.amount,
          month: d.month,
          method: d.method,
        },
      })
      return NextResponse.json(serializeSalaryPayment(payment))
    } catch (e) {
      // Unique constraint = this staff member was already paid for the month.
      if (prismaErrorCode(e) === 'P2002') {
        conflict(`Salary for ${staff.name} (${d.month}) was already paid`)
      }
      throw e
    }
  } catch (e) {
    return handleApiError(e)
  }
}
