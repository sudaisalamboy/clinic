import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner, createSession, logActivity } from '@/lib/auth'

// Delete every session for the owner, then create a fresh one for the
// current browser. Used for "Sign out all other devices".
export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await db.session.deleteMany({ where: { ownerId: owner.id } })
  await createSession(owner.id, owner.autoLockMinutes)
  await logActivity('revoke_sessions', `Owner "${owner.name}" revoked all other sessions`, req.ip)
  return NextResponse.json({ ok: true })
}
