import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  getCurrentOwner,
  hashPassword,
  verifyPassword,
  createSession,
  logActivity,
} from '@/lib/auth'

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
})

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = ChangePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const { currentPassword, newPassword } = parsed.data
  if (!verifyPassword(currentPassword, owner.passwordHash, owner.passwordSalt)) {
    return NextResponse.json(
      { error: 'Current password is incorrect.' },
      { status: 401 },
    )
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from the current one.' },
      { status: 400 },
    )
  }

  const { hash, salt } = hashPassword(newPassword)
  await db.owner.update({
    where: { id: owner.id },
    data: { passwordHash: hash, passwordSalt: salt },
  })
  // Drop all sessions for the owner (force re-login everywhere) and create a fresh one.
  await db.session.deleteMany({ where: { ownerId: owner.id } })
  await createSession(owner.id, owner.autoLockMinutes)
  await logActivity('password_change', `Owner "${owner.name}" changed password`, req.ip)

  return NextResponse.json({ ok: true })
}
