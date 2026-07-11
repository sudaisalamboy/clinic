import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      )
    }
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
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
