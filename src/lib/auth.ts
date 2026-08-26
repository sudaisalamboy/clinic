/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 *
 * Authentication layer:
 *  - Password hashing with argon2id (@node-rs/argon2)
 *  - Session tokens signed as JWTs (jose), each carrying a unique `jti`
 *  - Server-side revocation: logout records the token's `jti` in the
 *    RevokedSession table, so a stolen token cannot outlive the user's
 *    logout (a purely stateless JWT would stay valid for its full 24h TTL).
 *
 * `getCurrentUser` verifies the signature, checks the revocation list, and
 * re-reads the user from the DB (so role changes / deactivation take effect
 * on the very next request).
 */

import { randomBytes, randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2'
import { db } from './db'

export const SESSION_COOKIE = 'clinic_session'
const SESSION_TTL_SECONDS = 24 * 60 * 60 // 24 hours

// ---------- Auth secrets ----------
//
// In production we REQUIRE `AUTH_JWT_SECRET` to be set explicitly. A random
// fallback would reset on every serverless cold start, invalidating every
// outstanding session on each spin-up — unacceptable for real traffic. Fail
// fast at module load instead.
//
// In development we allow a process-cached random fallback so `bun run dev`
// boots without configuration, but we warn loudly that sessions won't survive
// a restart.
const isProduction = process.env.NODE_ENV === 'production'

function resolveAuthSecret(): Uint8Array {
  const fromEnv = process.env.AUTH_JWT_SECRET
  if (fromEnv) {
    if (fromEnv.length < 32) {
      throw new Error(
        'AUTH_JWT_SECRET must be at least 32 characters. Generate one with: `openssl rand -hex 32`',
      )
    }
    return new TextEncoder().encode(fromEnv)
  }
  if (isProduction) {
    throw new Error(
      'AUTH_JWT_SECRET is not set. Set it to a long random string (>= 32 chars) before running in production. ' +
        'Generate one with: `openssl rand -hex 32`',
    )
  }
  // Dev-only ephemeral fallback (cached per process).
  const hex = randomBytes(32).toString('hex')
  console.warn(
    `[auth] AUTH_JWT_SECRET is not set — generated a random ephemeral secret. ` +
      `Sessions will NOT survive a process restart. Set AUTH_JWT_SECRET for stable sessions.`,
  )
  return new TextEncoder().encode(hex)
}

const AUTH_SECRET: Uint8Array = resolveAuthSecret()

const AUTH_ISSUER = process.env.AUTH_JWT_ISSUER ?? 'clinic'
const AUTH_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? 'clinic-web'

// ---------- Password hashing (argon2id) ----------

/**
 * Hash a password with argon2id. The returned string encodes the salt,
 * memory/time/parallelism parameters, and the digest — so the whole
 * thing fits in a single column (no separate salt column needed).
 *
 * Parameters (OWASP-recommended for argon2id):
 *  - memoryCost: 19456 KiB (≈ 64 MiB resident)
 *  - timeCost: 2 iterations
 *  - parallelism: 1 lane
 */
export async function hashPassword(password: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id (the OWASP-recommended variant).
  // We omit the `algorithm` option because `Algorithm` is a `const enum`,
  // which cannot be referenced by value under `isolatedModules`.
  return argon2Hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
}

/** Verify a plaintext password against an argon2id-encoded hash string. */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    return await argon2Verify(hashedPassword, password)
  } catch {
    // Malformed hash / unsupported variant → treat as invalid credentials.
    return false
  }
}

// ---------- Session (JWT) management ----------

export interface SessionUser {
  id: string
  name: string
  role: string
}

/**
 * Issue a signed JWT (with a unique `jti` claim) and set it as the
 * `clinic_session` HttpOnly cookie.
 */
export async function createSession(user: SessionUser): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  const token = await new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setJti(randomUUID())
    .setIssuedAt()
    .setIssuer(AUTH_ISSUER)
    .setAudience(AUTH_AUDIENCE)
    .setExpirationTime(expiresAt)
    .sign(AUTH_SECRET)

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

/**
 * Destroy the current session. Beyond clearing the cookie, the token's
 * `jti` is recorded in the RevokedSession table so the token itself is
 * dead even if an attacker had copied it (XSS / log / sniff scenario).
 * Returns the userId of the revoked session (for audit) or null.
 */
export async function destroySession(): Promise<{ userId: string } | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value

  let revokedUserId: string | null = null
  if (token) {
    try {
      const { payload } = await jwtVerify(token, AUTH_SECRET, {
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      })
      const jti = payload.jti
      const sub = payload.sub
      const exp = payload.exp
      if (typeof jti === 'string' && typeof sub === 'string' && typeof exp === 'number') {
        await db.revokedSession.create({
          data: { id: jti, userId: sub, expiresAt: new Date(exp * 1000) },
        })
        revokedUserId = sub
        // Opportunistic cleanup — expired revocations are dead weight.
        await db.revokedSession
          .deleteMany({ where: { expiresAt: { lt: new Date() } } })
          .catch(() => {})
      }
    } catch {
      // Invalid / expired / already-revoked token — deleting the cookie is
      // sufficient; nothing more can be revoked.
    }
  }

  store.delete(SESSION_COOKIE)
  return revokedUserId ? { userId: revokedUserId } : null
}

// ---------- User access ----------

/**
 * Verify the JWT from the cookie, check it against the revocation list,
 * and fetch the user from the DB by `sub`. We trust the JWT signature
 * (issuer/audience/exp) but re-read the role/name from the DB so a
 * revoked/role-changed user is reflected immediately on the next request.
 * Returns null if no cookie, signature invalid, expired, revoked, or user
 * no longer exists.
 */
export async function getCurrentUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  let payload: { sub?: string; jti?: unknown }
  try {
    const verified = await jwtVerify(token, AUTH_SECRET, {
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    })
    payload = verified.payload
  } catch {
    // Invalid signature / expired / malformed → not authenticated.
    return null
  }

  const sub = payload.sub
  const jti = payload.jti
  if (!sub || typeof jti !== 'string') return null

  // Server-side revocation check (logout).
  try {
    const revoked = await db.revokedSession.findUnique({ where: { id: jti } })
    if (revoked) return null
  } catch {
    // If the revocation check itself fails, fail CLOSED (treat as
    // unauthenticated) — never let a DB hiccup resurrect a dead token.
    return null
  }

  const user = await db.user.findUnique({ where: { id: sub } })
  if (!user) return null
  if (!user.active) return null
  return user
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
