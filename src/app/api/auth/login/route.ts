/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'
import { getClientIp } from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'

// In-memory rate limiter — keyed on a single global key so ALL clients
// share the same bucket. This prevents bypass via header rotation
// (X-Forwarded-For, X-Real-IP, etc.). The tradeoff is that a shared
// bucket means 5 attempts/min total across all clients, but for a
// single-clinic app this is the safest approach.
//
// ⚠️ SERVERLESS CAVEAT: this state lives in module scope, so on platforms
// that spin up multiple isolated instances (Vercel/Lambda) each instance
// gets its OWN bucket — effective brute-force protection becomes
// probabilistic (attempts/N instances per window). For a single long-lived
// server (the documented deployment model) it is exact. If you deploy to
// serverless, front the login route with an edge rate-limiter (e.g. the
// platform's WAF / Upstash) for hard guarantees.
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 5 // 5 attempts per minute
let rateLimitCount = 0
let rateLimitResetAt = Date.now() + RATE_LIMIT_WINDOW_MS

function checkRateLimit(): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  if (now > rateLimitResetAt) {
    rateLimitCount = 1
    rateLimitResetAt = now + RATE_LIMIT_WINDOW_MS
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetMs: RATE_LIMIT_WINDOW_MS }
  }
  rateLimitCount++
  if (rateLimitCount > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetMs: rateLimitResetAt - now }
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - rateLimitCount, resetMs: rateLimitResetAt - now }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit check — global bucket, not per-IP (prevents XFF bypass)
    const rl = checkRateLimit()
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
        },
      )
    }

    // Parse JSON safely
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 },
      )
    }

    // Input validation — reject non-string types (prevents NoSQL/object injection)
    if (
      typeof body !== 'object' || body === null ||
      typeof (body as Record<string, unknown>).email !== 'string' ||
      typeof (body as Record<string, unknown>).password !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 400 },
      )
    }

    const { email, password } = body as { email: string; password: string }

    if (!email || !password || email.length > 200 || password.length > 200) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      )
    }

    // Normalise the email so case differences never split accounts.
    const normalizedEmail = email.trim().toLowerCase()

    // Query with validated string (Prisma parameterized — safe)
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      // Failed-login audit. `userId` is null because no authenticated
      // principal exists; `after` carries the attempted email only —
      // NEVER log the password.
      await writeAudit(
        { userId: null, ip: getClientIp(req) },
        'auth.login_failed',
        { entity: 'User', after: { email: normalizedEmail } },
      )
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }
    if (!user.active) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 403 },
      )
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      // Failed-login audit (wrong password). Still no authenticated user,
      // so userId stays null.
      await writeAudit(
        { userId: null, ip: getClientIp(req) },
        'auth.login_failed',
        { entity: 'User', after: { email: normalizedEmail } },
      )
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }

    await createSession({ id: user.id, name: user.name, role: user.role })
    // Successful-login audit — userId is now known.
    await writeAudit(
      { userId: user.id, ip: getClientIp(req) },
      'auth.login',
      { entity: 'User', entityId: user.id },
    )
    return NextResponse.json({
      user: { id: user.id, name: user.name, role: user.role, email: user.email },
    })
  } catch {
    // Never leak internal errors
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 },
    )
  }
}
