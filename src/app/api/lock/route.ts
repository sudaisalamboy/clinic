import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOwner, destroySession, logActivity } from '@/lib/auth'

// Manual lock — destroys the current session but does NOT log "logout".
// The next request will show the lock screen.
export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (owner) {
    await logActivity('manual_lock', `Owner "${owner.name}" locked the app`, req.ip)
  }
  await destroySession()
  return NextResponse.json({ ok: true })
}
