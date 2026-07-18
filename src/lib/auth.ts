/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from './db'

export const SESSION_COOKIE = 'clinic_session'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ---------- Password hashing (SHA-256 + salt) ----------

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(32).toString('hex')
  const hash = createHash('sha256')
    .update(salt + password)
    .digest('hex')
  return { hash, salt }
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  const candidate = Buffer.from(
    createHash('sha256')
      .update(salt + password)
      .digest('hex'),
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

export async function createSession(userId: string, _role?: string) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.session.create({
    data: { token, userId, expiresAt },
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

// ---------- User access ----------

export async function getCurrentUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  return session.user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'Admin') throw new Error('FORBIDDEN')
  return user
}
