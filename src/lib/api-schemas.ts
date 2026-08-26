/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

/**
 * Zod validation schemas for every mutating API route.
 *
 * Each schema strips unknown keys (`z.strictObject` is intentionally NOT
 * used to keep forward-compatibility with extra fields sent by older
 * frontends — instead we pick only the fields we want via `.shape`).
 *
 * `z.coerce.number()` is used so that values arriving as strings (e.g.
 * from query params or untyped JSON) are coerced AFTER the type check.
 *
 * MONEY: the API speaks rupees / percent; the DB stores integer paise /
 * basis points. Conversion lives in src/lib/money.ts and happens in the
 * route handlers — schemas validate the API-side (major-unit) values.
 */

import { z } from 'zod'
import { isValidTimeZone } from './time'

// ---------- Shared primitives ----------

/**
 * Convert empty strings / null to undefined BEFORE the inner schema runs.
 * HTML forms send `""` for unfilled optional fields, which would otherwise
 * fail `.email()` / date refinement. This normalises them away so the inner
 * optional schema accepts them.
 */
function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === '' || v === null ? undefined : v), schema)
}

const nonEmptyString = (label: string) =>
  z.string().trim().min(1, `${label} is required`)

const optionalString = emptyToUndefined(z.string().trim().optional())
const optionalEmail = emptyToUndefined(z.string().trim().email().optional())

// Accept either an ISO date (YYYY-MM-DD) or ISO 8601 datetime. We use a
// regex + Date.parse check rather than `z.iso.datetime()` so the schema
// works across zod v3 and v4.
const isoDateLike = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
const optionalIsoDate = emptyToUndefined(isoDateLike.optional())

/** Money in API units (rupees): non-negative with a sanity ceiling. */
const money = (label: string) =>
  z.coerce
    .number()
    .min(0, `${label} cannot be negative`)
    .max(10_000_000, `${label} is unrealistically large`)

/** Percentage in API units (0–100). */
const percent = (label: string) =>
  z.coerce
    .number()
    .min(0, `${label} cannot be negative`)
    .max(100, `${label} cannot exceed 100`)

// ---------- First-run setup ----------

export const setupSchema = z.object({
  name: nonEmptyString('Full name'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(200, 'Password is too long')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
})

// ---------- Staff ----------

export const staffCreateSchema = z.object({
  name: nonEmptyString('Name'),
  gender: optionalString,
  mobile: optionalString,
  email: optionalEmail,
  address: optionalString,
  photo: optionalString,
  role: z.enum(['Doctor', 'Nurse', 'Receptionist', 'Staff']).default('Staff'),
  department: optionalString,
  salary: money('Salary').default(0),
  joiningDate: optionalIsoDate,
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

export const staffUpdateSchema = staffCreateSchema.partial()

// ---------- Salary payments (payroll) ----------
//
// `month` is the salary period "YYYY-MM". The regex + range check keeps it
// a real calendar month (no "2026-99"), and the DB's @@unique([staffId,
// month]) turns a double-pay race into a clean 409.

function currentYear(): number {
  return new Date().getFullYear()
}

function isValidMonth(v: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(v)
  if (!m) return false
  const year = Number(m[1])
  const month = Number(m[2])
  return year >= 2000 && year <= currentYear() + 1 && month >= 1 && month <= 12
}

export const salaryPaymentCreateSchema = z.object({
  staffId: nonEmptyString('Staff member'),
  amount: money('Salary amount'),
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
    .refine(isValidMonth, 'Month must be a valid calendar month (YYYY-MM)'),
  method: z.enum(['Cash', 'UPI', 'Bank Transfer']).default('Cash'),
  note: optionalString,
})

// ---------- Suppliers ----------

export const supplierCreateSchema = z.object({
  name: nonEmptyString('Name'),
  mobile: optionalString,
  email: optionalEmail,
  address: optionalString,
  photo: optionalString,
  supplies: optionalString,
  notes: optionalString,
})

export const supplierUpdateSchema = supplierCreateSchema.partial()

// ---------- Inventory items ----------
//
// NOTE: `quantity` is deliberately ABSENT from the update schema. Stock
// levels may only change through /api/inventory/stock (which records a
// StockTransaction row) — a direct PUT would silently bypass that audit
// trail. quantity stays settable at creation (initial stock onboarding).

const inventoryItemEditable = z.object({
  name: nonEmptyString('Name'),
  categoryId: nonEmptyString('Category'),
  supplierId: optionalString,
  batchNumber: optionalString,
  expiryDate: optionalIsoDate,
  unit: optionalString,
  minStock: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .default(10), // matches the Prisma default — keeps low-stock alerts meaningful
  purchasePrice: money('Purchase price').default(0),
  sellingPrice: money('Selling price').default(0),
  mrp: money('MRP').default(0),
  gst: percent('GST').default(0),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

export const inventoryItemCreateSchema = inventoryItemEditable.extend({
  quantity: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .default(0),
})

export const inventoryItemUpdateSchema = inventoryItemEditable.partial()

// ---------- Inventory categories ----------

export const inventoryCategoryCreateSchema = z.object({
  name: nonEmptyString('Name'),
  order: z.coerce.number().int().min(0).optional(),
})

// ---------- Inventory stock transactions ----------
//
// Semantics:
//  - in / out / return → `quantity` is a DELTA (≥ 1)
//  - adjust            → `quantity` is the ABSOLUTE new level (≥ 0)

export const stockTransactionSchema = z
  .object({
    itemId: nonEmptyString('Item'),
    type: z.enum(['in', 'out', 'adjust', 'return']),
    quantity: z.coerce.number().int().min(0).max(1_000_000),
    note: optionalString,
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'adjust' && v.quantity < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Quantity must be a positive integer',
      })
    }
  })

// ---------- Appointments ----------

export const appointmentCreateSchema = z.object({
  patientName: nonEmptyString('Patient name'),
  patientId: optionalString,
  mobile: optionalString,
  staffId: optionalString,
  consultationFeeId: optionalString,
  date: z
    .string()
    .trim()
    .min(1, 'Date is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  type: z.enum(['Walk-in', 'Website', 'Phone']).default('Walk-in'),
  fee: money('Fee').default(0),
  status: z.enum(['Pending', 'Completed', 'Cancelled', 'No Show']).default('Pending'),
  notes: optionalString,
})

export const appointmentUpdateSchema = appointmentCreateSchema.partial()

// ---------- Bills ----------

export const billItemSchema = z.object({
  itemId: optionalString,
  name: nonEmptyString('Item name'),
  qty: z.coerce
    .number()
    .int()
    .min(1, 'Quantity must be a positive integer')
    .max(100_000),
  // NOTE: for inventory-linked items this is display-only — the server
  // always uses the inventory item's sellingPrice. For custom line items
  // (no itemId) the value is accepted but bounded.
  price: money('Price'),
})

export const billCreateSchema = z
  .object({
    patientName: nonEmptyString('Patient name'),
    patientId: optionalString,
    items: z.array(billItemSchema).default([]),
    consultationCharge: money('Consultation charge').default(0),
    discount: z.coerce.number().min(0).max(10_000_000).default(0),
    discountType: z.enum(['fixed', 'percent']).default('fixed'),
    gst: percent('GST').default(0),
    paymentMethod: z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer']).default('Cash'),
    paymentStatus: z.enum(['Pending', 'Paid']).default('Pending'),
    appointmentId: optionalString,
    mobile: optionalString,
    notes: optionalString,
  })
  .superRefine((v, ctx) => {
    if (v.discountType === 'percent' && v.discount > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount'],
        message: 'Percent discount cannot exceed 100',
      })
    }
  })

export const billUpdateSchema = z
  .object({
    paymentStatus: z.enum(['Pending', 'Paid']).optional(),
    paymentMethod: z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer']).optional(),
    notes: optionalString,
    discount: z.coerce.number().min(0).max(10_000_000).optional(),
    discountType: z.enum(['fixed', 'percent']).optional(),
    gst: percent('GST').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === 'percent' && (v.discount ?? 0) > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount'],
        message: 'Percent discount cannot exceed 100',
      })
    }
  })

// ---------- Consultation fees ----------

export const consultationFeeCreateSchema = z.object({
  name: nonEmptyString('Name'),
  fee: money('Fee').default(0),
  description: optionalString,
})

export const consultationFeeUpdateSchema = consultationFeeCreateSchema.partial()

// ---------- Settings ----------

const hexColor = emptyToUndefined(
  z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex color like #10b981')
    .optional(),
)

const timeZone = emptyToUndefined(
  z
    .string()
    .trim()
    .refine((v) => isValidTimeZone(v), 'Unknown timezone')
    .optional(),
)

export const settingsUpdateSchema = z.object({
  clinicName: optionalString,
  logo: optionalString,
  doctorName: optionalString,
  mobile: optionalString,
  email: optionalEmail,
  address: optionalString,
  gstNumber: optionalString,
  currency: optionalString,
  timezone: timeZone,
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
})

// ---------- Patients ----------

export const patientCreateSchema = z.object({
  name: nonEmptyString('Patient name'),
  mobile: optionalString,
  email: optionalEmail,
  address: optionalString,
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  age: z.coerce.number().int().min(0).max(150).optional(),
  notes: optionalString,
})
export const patientUpdateSchema = patientCreateSchema.partial()

// ---------- URL param helpers ----------

export const idParamSchema = z.object({
  id: z.string().trim().min(1, 'Missing id parameter'),
})
