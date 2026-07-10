import { NextRequest, NextResponse } from 'next/server'
import { getCurrentOwner, destroySession, logActivity } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (owner) {
    await logActivity('logout', `Owner "${owner.name}" signed out`, req.ip)
  }
  await destroySession()
  return NextResponse.json({ ok: true })
}
