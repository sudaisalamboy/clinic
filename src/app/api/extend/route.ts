import { NextResponse } from 'next/server'
import { getCurrentOwner, extendSession } from '@/lib/auth'

// Refresh the session expiry (called by the client on activity).
export async function POST() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const expiresAt = await extendSession(owner.autoLockMinutes)
  return NextResponse.json({
    ok: true,
    expiresAt: expiresAt?.toISOString(),
    autoLockMinutes: owner.autoLockMinutes,
  })
}
