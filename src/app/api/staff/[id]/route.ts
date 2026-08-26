/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { handleApiError, safeJson, badRequest, notFound, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { staffUpdateSchema, idParamSchema } from '@/lib/api-schemas'
import { toPaise, serializeStaff, toRupees } from '@/lib/money'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Capture the admin user so we can audit the mutation if/when needed.
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = staffUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const exists = await db.staff.findUnique({ where: { id } })
    if (!exists) notFound('Staff not found')
    const item = await db.staff.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.gender !== undefined && { gender: d.gender || null }),
        ...(d.mobile !== undefined && { mobile: d.mobile || null }),
        ...(d.email !== undefined && { email: d.email || null }),
        ...(d.address !== undefined && { address: d.address || null }),
        ...(d.photo !== undefined && { photo: d.photo || null }),
        ...(d.role !== undefined && { role: d.role }),
        ...(d.department !== undefined && { department: d.department || null }),
        ...(d.salary !== undefined && { salary: toPaise(d.salary) }),
        ...(d.joiningDate !== undefined && {
          joiningDate: d.joiningDate ? new Date(d.joiningDate) : new Date(),
        }),
        ...(d.status !== undefined && { status: d.status }),
      },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'staff.update', {
      entity: 'Staff',
      entityId: id,
      before: { ...exists, salary: toRupees(exists.salary) },
      after: { ...item, salary: toRupees(item.salary) },
    })
    return NextResponse.json(serializeStaff(item))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin()
    const { id } = idParamSchema.parse(await params)
    const exists = await db.staff.findUnique({ where: { id } })
    if (!exists) notFound('Staff not found')
    // SOFT-DELETE: hard-deleting staff would orphan appointments (staffId
    // becomes null via SetNull, losing the doctor attribution and the
    // audit trail). Soft-delete preserves history while hiding the row
    // from the active list.
    const item = await db.staff.update({
      where: { id },
      data: { status: 'Inactive' },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(_req) }, 'staff.soft_delete', {
      entity: 'Staff',
      entityId: id,
      after: { id: item.id, name: item.name, status: item.status },
    })
    return NextResponse.json({ ok: true, softDeleted: true })
  } catch (e) {
    return handleApiError(e)
  }
}
