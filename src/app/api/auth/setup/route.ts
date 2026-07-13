import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

// GET — auto-creates the default admin account if no users exist.
// No user interaction needed. Default credentials:
//   Email: admin@clinic.com
//   Password: admin123
export async function GET() {
  try {
    const userCount = await db.user.count()
    if (userCount > 0) {
      return NextResponse.json({ ok: true, message: 'Setup already completed' })
    }

    // Create default admin
    const { hash, salt } = hashPassword('admin123')
    const user = await db.user.create({
      data: {
        name: 'Admin',
        email: 'admin@clinic.com',
        passwordHash: hash,
        passwordSalt: salt,
        role: 'Admin',
      },
    })

    // Default settings
    await getSettings()

    // Default consultation fees
    await db.consultationFee.createMany({
      data: [
        { name: 'General OPD', fee: 50, description: 'General consultation' },
        { name: 'Follow Up', fee: 30, description: 'Follow-up visit' },
        { name: 'Emergency', fee: 100, description: 'Emergency consultation' },
      ],
    })

    // Default inventory categories
    const cats = [
      'Medicines', 'Injections', 'Syrup', 'Gloves', 'Syringe',
      'IV Fluids', 'Cotton', 'Bandage', 'Surgical Items', 'Other',
    ]
    await db.inventoryCategory.createMany({
      data: cats.map((name, i) => ({ name, order: i })),
    })

    await createSession(user.id, user.role)

    return NextResponse.json({
      ok: true,
      message: 'Default admin created',
      credentials: { email: 'admin@clinic.com', password: 'admin123' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Setup failed' },
      { status: 500 },
    )
  }
}
