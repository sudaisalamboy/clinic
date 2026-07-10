import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentOwner, extendSession, logActivity } from '@/lib/auth'

const SettingsSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  autoLockMinutes: z.number().int().min(1).max(1440).optional(),
  passwordHint: z.string().max(120).nullable().optional(),
})

export async function GET() {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return NextResponse.json({
    owner: {
      id: owner.id,
      name: owner.name,
      autoLockMinutes: owner.autoLockMinutes,
      passwordHint: owner.passwordHint,
      createdAt: owner.createdAt,
      updatedAt: owner.updatedAt,
    },
  })
}

export async function PUT(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = SettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.autoLockMinutes !== undefined)
    data.autoLockMinutes = parsed.data.autoLockMinutes
  if (parsed.data.passwordHint !== undefined)
    data.passwordHint = parsed.data.passwordHint

  const updated = await db.owner.update({
    where: { id: owner.id },
    data,
  })

  // Refresh the session cookie with the new autoLockMinutes
  await extendSession(updated.autoLockMinutes)
  await logActivity('settings_update', `Owner settings updated`, req.ip)

  return NextResponse.json({
    ok: true,
    owner: {
      id: updated.id,
      name: updated.name,
      autoLockMinutes: updated.autoLockMinutes,
      passwordHint: updated.passwordHint,
    },
  })
}
