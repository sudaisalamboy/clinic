import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

export async function GET() {
  try {
    const usersExist = (await db.user.count()) > 0
    const user = await getCurrentUser()
    let settings = null
    if (usersExist) {
      settings = await getSettings()
    }
    return NextResponse.json({
      usersExist,
      authenticated: !!user,
      user: user
        ? { id: user.id, name: user.name, role: user.role }
        : null,
      settings: settings
        ? { clinicName: settings.clinicName, currency: settings.currency }
        : null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
