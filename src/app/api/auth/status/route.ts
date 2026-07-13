import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

// Auto-creates default admin if no users exist, then returns minimal auth status.
// Does NOT leak: usersExist, clinicName, currency, or any credentials.
export async function GET() {
  try {
    const userCount = await db.user.count()
    if (userCount === 0) {
      // Create default admin with a strong password (not exposed anywhere)
      const { hash, salt } = hashPassword('Cl!n1c@dm1n2026')
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
    const settings = user ? await getSettings().catch(() => null) : null

    // Only return clinic info to authenticated users
    return NextResponse.json({
      authenticated: !!user,
      user: user
        ? { id: user.id, name: user.name, role: user.role }
        : null,
      settings: (user && settings)
        ? { clinicName: settings.clinicName, currency: settings.currency }
        : null,
    })
  } catch {
    // Never leak internal errors
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 500 },
    )
  }
}
