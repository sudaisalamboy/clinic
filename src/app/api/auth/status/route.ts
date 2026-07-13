import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword, createSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

// Auto-creates default admin if no users exist, then returns auth status
export async function GET() {
  try {
    const userCount = await db.user.count()
    if (userCount === 0) {
      // Create default admin
      const { hash, salt } = hashPassword('admin123')
      await db.user.create({
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
    }

    const user = await getCurrentUser()
    const settings = await getSettings().catch(() => null)

    return NextResponse.json({
      usersExist: true,
      authenticated: !!user,
      user: user
        ? { id: user.id, name: user.name, role: user.role }
        : null,
      settings: settings
        ? { clinicName: settings.clinicName, currency: settings.currency }
        : null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
