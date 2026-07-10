import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  verifyPassword,
  createSession,
  registerFailedAttempt,
  resetFailedAttempts,
  getLockStatus,
  logActivity,
  ATTEMPT_LIMIT,
} from '@/lib/auth'

const LoginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const owner = await db.owner.findFirst()
  if (!owner) {
    return NextResponse.json(
      { error: 'No owner exists yet. Please run setup first.' },
      { status: 404 },
    )
  }

  // Check lockout
  const lock = await getLockStatus(owner.id)
  if (lock.locked) {
    return NextResponse.json(
      {
        error: 'Too many failed attempts. Locked out.',
        locked: true,
        remainingMs: lock.remainingMs,
      },
      { status: 429 },
    )
  }

  const ok = verifyPassword(parsed.data.password, owner.passwordHash, owner.passwordSalt)
  if (!ok) {
    const { locked, attempts } = await registerFailedAttempt(owner.id)
    await logActivity('login_failed', `Attempt ${attempts}/${ATTEMPT_LIMIT}`, req.ip)
    if (locked) {
      return NextResponse.json(
        {
          error: `Locked out after ${ATTEMPT_LIMIT} failed attempts. Try again later.`,
          locked: true,
          remainingMs: 15 * 60 * 1000,
        },
        { status: 429 },
      )
    }
    const remaining = ATTEMPT_LIMIT - attempts
    return NextResponse.json(
      {
        error: `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        attemptsLeft: remaining,
      },
      { status: 401 },
    )
  }

  // Success
  await resetFailedAttempts(owner.id)
  await createSession(owner.id, owner.autoLockMinutes)
  await logActivity('login', `Owner "${owner.name}" signed in`, req.ip)

  return NextResponse.json({
    ok: true,
    owner: { id: owner.id, name: owner.name, autoLockMinutes: owner.autoLockMinutes },
  })
}
