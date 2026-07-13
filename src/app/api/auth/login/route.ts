import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'

// In-memory rate limiter (per IP, resets every minute)
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 5 // 5 attempts per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetMs: RATE_LIMIT_WINDOW_MS }
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetMs: entry.resetAt - now }
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetMs: entry.resetAt - now }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rl = checkRateLimit(ip)
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

    // Query with validated string (Prisma parameterized — safe)
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
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

    const ok = verifyPassword(password, user.passwordHash, user.passwordSalt)
    if (!ok) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }

    await createSession(user.id, user.role)
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
