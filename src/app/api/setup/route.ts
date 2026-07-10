import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, createSession, getOwnerCount, logActivity } from '@/lib/auth'

const SetupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  passwordHint: z.string().max(120).optional(),
  autoLockMinutes: z.number().int().min(1).max(1440).default(15),
})

// First-time setup: create THE owner. Only allowed if no owner exists yet.
export async function POST(req: NextRequest) {
  if ((await getOwnerCount()) > 0) {
    return NextResponse.json(
      { error: 'Owner already exists. This app is single-user and locked.' },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = SetupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const { name, password, passwordHint, autoLockMinutes } = parsed.data
  const { hash, salt } = hashPassword(password)

  const owner = await db.owner.create({
    data: {
      name,
      passwordHash: hash,
      passwordSalt: salt,
      passwordHint: passwordHint ?? null,
      autoLockMinutes,
    },
  })

  await createSession(owner.id, autoLockMinutes)
  await logActivity('setup', `Owner "${name}" created`, req.ip)

  // Seed a handful of default departments so the doctor form has options immediately.
  const defaultDepartments = [
    'General Medicine',
    'Cardiology',
    'Pediatrics',
    'Orthopedics',
    'Dermatology',
    'ENT',
    'Gynecology',
    'Neurology',
  ]
  try {
    // Create departments one by one, skipping any that already exist.
    for (const name of defaultDepartments) {
      const exists = await db.department.findUnique({ where: { name } })
      if (!exists) {
        await db.department.create({ data: { name } })
      }
    }
  } catch (e) {
    console.error('Failed to seed default departments:', e)
  }

  return NextResponse.json({
    ok: true,
    owner: { id: owner.id, name: owner.name, autoLockMinutes: owner.autoLockMinutes },
  })
}
