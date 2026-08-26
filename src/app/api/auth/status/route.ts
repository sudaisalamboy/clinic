/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

/**
 * Auth status probe. Deliberately does NOT seed anything (first-run admin
 * creation lives in POST /api/auth/setup) — an unauthenticated GET must
 * never be able to trigger a write.
 *
 * Exposes only:
 *  - authenticated / user (when signed in)
 *  - settings.clinicName + currency (when signed in)
 *  - needsSetup: true only when no user exists yet (drives the setup UI)
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    let needsSetup = false
    if (!user) {
      try {
        needsSetup = (await db.user.count()) === 0
      } catch {
        needsSetup = false
      }
    }

    const settings = user ? await getSettings().catch(() => null) : null

    // Only return clinic info to authenticated users
    return NextResponse.json({
      authenticated: !!user,
      user: user
        ? { id: user.id, name: user.name, role: user.role }
        : null,
      settings: (user && settings)
        ? { clinicName: settings.clinicName, currency: settings.currency }
        : null,
      needsSetup,
    })
  } catch (e) {
    // Never leak internal errors, but log the real cause server-side.
    console.error('[auth/status] failed:', e)
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 500 },
    )
  }
}
