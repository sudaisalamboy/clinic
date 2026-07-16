import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getCurrentOwner,
  getOwnerCount,
  getLockStatus,
} from '@/lib/auth'

// Returns public status: whether an owner exists, whether the caller is
// currently authenticated as that owner, and (if locked out) the lockout
// remaining time. Does NOT leak any owner secrets.
export async function GET() {
  const ownerExists = (await getOwnerCount()) > 0

  if (!ownerExists) {
    return NextResponse.json({
      ownerExists: false,
      authenticated: false,
      owner: null,
      lock: { locked: false, remainingMs: 0 },
    })
  }

  const owner = await db.owner.findFirst()
  const lock = owner ? await getLockStatus(owner.id) : { locked: false, remainingMs: 0 }
  const current = await getCurrentOwner()
  const authenticated = !!current

  return NextResponse.json({
    ownerExists: true,
    authenticated,
    owner: authenticated
      ? { id: current!.id, name: current!.name, autoLockMinutes: current!.autoLockMinutes }
      : owner
        ? { name: owner.name, passwordHint: owner.passwordHint }
        : null,
    lock,
  })
}
