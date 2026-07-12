import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

export async function POST(req: Request) {
  try {
    const userCount = await db.user.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Setup already completed' },
        { status: 400 },
      )
    }

    const body = await req.json()
    const { name, email, password, role } = body
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 },
      )
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 },
      )
    }

    const { hash, salt } = hashPassword(password)
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        role: role === 'Receptionist' ? 'Receptionist' : 'Admin',
      },
    })

    // Default settings
    await getSettings()

    // Default consultation fees
    const feeCount = await db.consultationFee.count()
    if (feeCount === 0) {
      await db.consultationFee.createMany({
        data: [
          { name: 'General OPD', fee: 50, description: 'General consultation' },
          { name: 'Follow Up', fee: 30, description: 'Follow-up visit' },
          { name: 'Emergency', fee: 100, description: 'Emergency consultation' },
        ],
      })
    }

    // Default inventory categories
    const catCount = await db.inventoryCategory.count()
    if (catCount === 0) {
      const cats = [
        'Medicines',
        'Injections',
        'Syrup',
        'Gloves',
        'Syringe',
        'IV Fluids',
        'Cotton',
        'Bandage',
        'Surgical Items',
        'Other',
      ]
      await db.inventoryCategory.createMany({
        data: cats.map((name, i) => ({ name, order: i })),
      })
    }

    await createSession(user.id, user.role)

    return NextResponse.json({
      user: { id: user.id, name: user.name, role: user.role },
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Setup failed' },
      { status: 500 },
    )
  }
}
