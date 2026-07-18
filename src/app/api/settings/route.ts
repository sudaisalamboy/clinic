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

export async function GET() {
  try {
    await requireUser()
    const settings = await getSettings()
    return NextResponse.json(settings)
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json(
      { error: msg === 'UNAUTHORIZED' ? 'Unauthorized' : 'Server error' },
      { status: msg === 'UNAUTHORIZED' ? 401 : 500 },
    )
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const settings = await getSettings()
    const updated = await db.settings.update({
      where: { id: settings.id },
      data: {
        clinicName: body.clinicName ?? settings.clinicName,
        logo: body.logo ?? settings.logo,
        doctorName: body.doctorName ?? settings.doctorName,
        mobile: body.mobile ?? settings.mobile,
        email: body.email ?? settings.email,
        address: body.address ?? settings.address,
        gstNumber: body.gstNumber ?? settings.gstNumber,
        currency: body.currency ?? settings.currency,
        timezone: body.timezone ?? settings.timezone,
        primaryColor: body.primaryColor ?? settings.primaryColor,
        accentColor: body.accentColor ?? settings.accentColor,
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    const msg = (e as Error).message
    const status = msg === 'UNAUTHORIZED' ? 401 : msg === 'FORBIDDEN' ? 403 : 500
    return NextResponse.json({ error: 'Save failed' }, { status })
  }
}
