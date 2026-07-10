import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from './db'

export const SESSION_COOKIE = 'owner_session'
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

// ---------- Password hashing ----------

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  const candidate = Buffer.from(
    scryptSync(password, salt, 64).toString('hex'),
    'hex',
  )
  const target = Buffer.from(hash, 'hex')
  if (candidate.length !== target.length) return false
  return timingSafeEqual(candidate, target)
}

// ---------- Session token ----------

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(ownerId: string, autoLockMinutes: number) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + autoLockMinutes * 60 * 1000)
  await db.session.create({
    data: { token, ownerId, expiresAt },
  })
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
  return token
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  store.delete(SESSION_COOKIE)
}

export async function extendSession(autoLockMinutes: number) {
  const owner = await getCurrentOwner()
  if (!owner) return null
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const expiresAt = new Date(Date.now() + autoLockMinutes * 60 * 1000)
  await db.session.updateMany({ where: { token }, data: { expiresAt } })
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
  return expiresAt
}

// ---------- Owner access ----------

export async function getCurrentOwner() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
    include: { owner: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  return session.owner
}

export async function getOwnerCount(): Promise<number> {
  return db.owner.count()
}

export async function requireOwner() {
  const owner = await getCurrentOwner()
  if (!owner) {
    throw new Error('UNAUTHORIZED')
  }
  return owner
}

// ---------- Failed attempt tracking ----------

export const ATTEMPT_LIMIT = MAX_FAILED_ATTEMPTS
export const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000

export async function registerFailedAttempt(ownerId: string) {
  const owner = await db.owner.findUnique({ where: { id: ownerId } })
  if (!owner) return { locked: false, attempts: 0 }
  const attempts = owner.failedAttempts + 1
  const shouldLock = attempts >= MAX_FAILED_ATTEMPTS
  await db.owner.update({
    where: { id: ownerId },
    data: {
      failedAttempts: attempts,
      lockedUntil: shouldLock
        ? new Date(Date.now() + LOCKOUT_MS)
        : owner.lockedUntil,
    },
  })
  return { locked: shouldLock, attempts }
}

export async function resetFailedAttempts(ownerId: string) {
  await db.owner.update({
    where: { id: ownerId },
    data: { failedAttempts: 0, lockedUntil: null },
  })
}

export async function getLockStatus(ownerId: string) {
  const owner = await db.owner.findUnique({ where: { id: ownerId } })
  if (!owner) return { locked: false, remainingMs: 0 }
  if (owner.lockedUntil && owner.lockedUntil.getTime() > Date.now()) {
    return {
      locked: true,
      remainingMs: owner.lockedUntil.getTime() - Date.now(),
    }
  }
  // lockout expired — reset
  if (owner.lockedUntil) {
    await db.owner.update({
      where: { id: ownerId },
      data: { failedAttempts: 0, lockedUntil: null },
    })
  }
  return { locked: false, remainingMs: 0 }
}

// ---------- Activity logging ----------

export async function logActivity(
  action: string,
  detail?: string,
  ip?: string,
) {
  await db.activityLog
    .create({ data: { action, detail, ip } })
    .catch(() => {})
}
