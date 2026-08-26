/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { requireUser, requireAdmin } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { db } from '@/lib/db'
import { handleApiError, safeJson, badRequest, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { settingsUpdateSchema } from '@/lib/api-schemas'

export async function GET() {
  try {
    await requireUser()
    const settings = await getSettings()
    return NextResponse.json(settings)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAdmin()
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = settingsUpdateSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data
    const settings = await getSettings()
    // Capture the existing settings BEFORE the update so the audit log
    // records a true before/after diff (HIPAA-style trail).
    const existing = await db.settings.findUnique({ where: { id: settings.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }
    const updated = await db.settings.update({
      where: { id: settings.id },
      data: {
        ...(d.clinicName !== undefined && { clinicName: d.clinicName }),
        ...(d.logo !== undefined && { logo: d.logo }),
        ...(d.doctorName !== undefined && { doctorName: d.doctorName }),
        ...(d.mobile !== undefined && { mobile: d.mobile }),
        ...(d.email !== undefined && { email: d.email }),
        ...(d.address !== undefined && { address: d.address }),
        ...(d.gstNumber !== undefined && { gstNumber: d.gstNumber }),
        ...(d.currency !== undefined && { currency: d.currency }),
        ...(d.timezone !== undefined && { timezone: d.timezone }),
        ...(d.primaryColor !== undefined && { primaryColor: d.primaryColor }),
        ...(d.accentColor !== undefined && { accentColor: d.accentColor }),
      },
    })
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'settings.update', {
      entity: 'Settings',
      entityId: updated.id,
      before: existing,
      after: updated,
    })
    return NextResponse.json(updated)
  } catch (e) {
    return handleApiError(e)
  }
}
