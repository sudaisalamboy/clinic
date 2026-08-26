/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

/**
 * Default clinic data (settings singleton, consultation fees, inventory
 * categories) created during first-run setup — inside the same transaction
 * as the first admin user. Money values are INTEGER PAISE (₹1 = 100).
 */
import type { Prisma } from '@prisma/client'

const DEFAULT_CONSULTATION_FEES = [
  { name: 'General OPD', fee: 5_000, description: 'General consultation' }, // ₹50
  { name: 'Follow Up', fee: 3_000, description: 'Follow-up visit' }, // ₹30
  { name: 'Emergency', fee: 10_000, description: 'Emergency consultation' }, // ₹100
]

const DEFAULT_CATEGORIES = [
  'Medicines', 'Injections', 'Syrup', 'Gloves', 'Syringe',
  'IV Fluids', 'Cotton', 'Bandage', 'Surgical Items', 'Other',
]

/** Idempotent seeding of default clinic data. Safe to call repeatedly. */
export async function seedDefaultData(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const settings = await tx.settings.findFirst()
  if (!settings) {
    await tx.settings.create({ data: {} })
  }

  const feeCount = await tx.consultationFee.count()
  if (feeCount === 0) {
    await tx.consultationFee.createMany({ data: DEFAULT_CONSULTATION_FEES })
  }

  const catCount = await tx.inventoryCategory.count()
  if (catCount === 0) {
    await tx.inventoryCategory.createMany({
      data: DEFAULT_CATEGORIES.map((name, i) => ({ name, order: i })),
    })
  }
}
