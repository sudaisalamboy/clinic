/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { destroySession, getCurrentUser } from '@/lib/auth'
import { handleApiError, getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'

/**
 * Logout. Revokes the session server-side (the JWT's jti is recorded in
 * RevokedSession, so a copied token dies too), clears the cookie, and
 * writes an audit entry. Errors are mapped through handleApiError —
 * internal messages are never echoed to the client.
 */
export async function POST(req: Request) {
  try {
    // Capture who is logging out (best-effort) before the session dies.
    const current = await getCurrentUser().catch(() => null)
    const revoked = await destroySession()
    await writeAudit(
      { userId: revoked?.userId ?? current?.id ?? null, ip: getClientIp(req) },
      'auth.logout',
      { entity: 'User', entityId: revoked?.userId ?? current?.id ?? undefined },
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
