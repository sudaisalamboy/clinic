/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

/**
 * Money handling.
 *
 * ALL monetary values are persisted as INTEGER PAISE (₹1 = 100) and all
 * percentage-like values (GST, percent discounts) as INTEGER BASIS POINTS
 * (1% = 100). SQLite has no native DECIMAL type and Float cannot represent
 * most decimal currency values exactly (0.1 + 0.2 !== 0.3), which accumulates
 * rounding drift across thousands of bills. Integer minor units make every
 * financial computation exact.
 *
 * The REST API still speaks "major units" (rupees / percent) so the frontend
 * is unaffected — conversion happens ONLY at the route boundary via the
 * helpers below.
 */

/** Sanity cap for a single line-item / money amount: ₹10,000,000. */
export const MAX_MONEY_RUPEES = 10_000_000
export const MAX_LINE_ITEM_PAISE = MAX_MONEY_RUPEES * 100

/** rupees (API) → paise (DB). Rounds to the nearest paise. */
export function toPaise(rupees: number): number {
  return Math.round((Number(rupees) || 0) * 100)
}

/** paise (DB) → rupees (API). */
export function toRupees(paise: number): number {
  return (Number(paise) || 0) / 100
}

/** percent (API, e.g. 18 or 0.25) → basis points (DB, 1800 / 25). */
export function toBps(percent: number): number {
  return Math.round((Number(percent) || 0) * 100)
}

/** basis points (DB) → percent (API). */
export function toPercent(bps: number): number {
  return (Number(bps) || 0) / 100
}

/**
 * Stored representation of a discount value.
 * - discountType 'fixed'   → paise
 * - discountType 'percent' → basis points
 */
export function toStoredDiscount(discount: number, discountType: string): number {
  return discountType === 'percent' ? toBps(discount) : toPaise(discount)
}

/** Inverse of toStoredDiscount — for API serialization. */
export function discountFromStored(discount: number, discountType: string): number {
  return discountType === 'percent' ? toPercent(discount) : toRupees(discount)
}

// ---------- Entity serializers (DB row → API JSON) ----------
//
// Every route that returns one of these entities MUST pass the row through
// the matching serializer so money/percent fields come back in major units.

interface StaffLike {
  salary: number
}

interface InventoryPrices {
  purchasePrice: number
  sellingPrice: number
  mrp: number
  gst: number
}

interface ConsultationFeeLike {
  fee: number
}

interface AppointmentLike {
  fee: number
}

interface BillItemLike {
  price: number
  item?: unknown
}

interface BillLike {
  consultationCharge: number
  medicineCharge: number
  discount: number
  discountType: string
  gst: number
  grandTotal: number
  items?: readonly BillItemLike[]
}

export function serializeStaff<T extends StaffLike>(staff: T): T {
  return { ...staff, salary: toRupees(staff.salary) }
}

interface SalaryPaymentLike {
  amount: number
}

export function serializeSalaryPayment<T extends SalaryPaymentLike>(payment: T): T {
  return { ...payment, amount: toRupees(payment.amount) }
}

export function serializeInventoryItem<T extends InventoryPrices>(item: T): T {
  return {
    ...item,
    purchasePrice: toRupees(item.purchasePrice),
    sellingPrice: toRupees(item.sellingPrice),
    mrp: toRupees(item.mrp),
    gst: toPercent(item.gst),
  }
}

export function serializeConsultationFee<T extends ConsultationFeeLike>(fee: T): T {
  return { ...fee, fee: toRupees(fee.fee) }
}

export function serializeAppointment<T extends AppointmentLike>(appt: T): T {
  return { ...appt, fee: toRupees(appt.fee) }
}

export function serializeBillItem(it: BillItemLike): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(it as unknown as Record<string, unknown>) }
  out.price = toRupees(it.price)
  // Nested inventory item (from `include: { item: true }` on BillItem).
  if (it.item !== undefined && it.item !== null) {
    out.item = serializeInventoryItem(it.item as InventoryPrices)
  }
  return out
}

export function serializeBill(bill: BillLike): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(bill as unknown as Record<string, unknown>) }
  out.consultationCharge = toRupees(bill.consultationCharge)
  out.medicineCharge = toRupees(bill.medicineCharge)
  out.discount = discountFromStored(bill.discount, bill.discountType)
  out.gst = toPercent(bill.gst)
  out.grandTotal = toRupees(bill.grandTotal)
  if (bill.items !== undefined) {
    out.items = bill.items.map(serializeBillItem)
  }
  return out
}

// ---------- Bill total computation (exact integer math) ----------
//
// All inputs/outputs are in MINOR UNITS (paise / basis points) so the whole
// computation is integer arithmetic — no floating point anywhere.

export interface BillTotalsInput {
  /** paise */
  consultationCharge: number
  /** paise (sum of qty × price per line) */
  medicineCharge: number
  /** stored discount (paise for 'fixed', basis points for 'percent') */
  discount: number
  discountType: string
  /** basis points */
  gst: number
}

export interface BillTotals {
  /** paise */
  medicineCharge: number
  /** paise */
  discountAmount: number
  /** paise */
  gstAmount: number
  /** paise */
  grandTotal: number
}

export function calcBillTotals(input: BillTotalsInput): BillTotals {
  const consultation = Math.max(0, Math.round(input.consultationCharge) || 0)
  const medicineCharge = Math.max(0, Math.round(input.medicineCharge) || 0)
  const subtotal = consultation + medicineCharge

  let discountAmount = 0
  if (input.discountType === 'percent') {
    discountAmount = Math.round((subtotal * Math.max(0, input.discount)) / 10_000)
  } else {
    discountAmount = Math.max(0, Math.round(input.discount) || 0)
  }
  discountAmount = Math.min(discountAmount, subtotal)

  const afterDiscount = subtotal - discountAmount
  const gstAmount = Math.round((afterDiscount * Math.max(0, input.gst)) / 10_000)
  const grandTotal = Math.max(0, afterDiscount + gstAmount)

  return { medicineCharge, discountAmount, gstAmount, grandTotal }
}
