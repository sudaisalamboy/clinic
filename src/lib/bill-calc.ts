/** Shared billing calculations used by both the API and the client UI. */

export interface LineItem {
  category: 'medicine' | 'lab' | 'other'
  name: string
  qty: number
  price: number
}

export interface BillCalcInput {
  consultationFee: number
  items: LineItem[]
  discountType: 'percent' | 'fixed'
  discountValue: number
  taxRate: number // percent, e.g. 8.5
}

export interface BillCalcResult {
  consultationFee: number
  medicineCharges: number
  labCharges: number
  otherCharges: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export function calculateBill(input: BillCalcInput): BillCalcResult {
  const consultationFee = Math.max(0, input.consultationFee || 0)

  const medicineCharges = input.items
    .filter((i) => i.category === 'medicine')
    .reduce((s, i) => s + i.qty * i.price, 0)
  const labCharges = input.items
    .filter((i) => i.category === 'lab')
    .reduce((s, i) => s + i.qty * i.price, 0)
  const otherCharges = input.items
    .filter((i) => i.category === 'other')
    .reduce((s, i) => s + i.qty * i.price, 0)

  const subtotal = consultationFee + medicineCharges + labCharges + otherCharges

  // Discount
  let discountAmount = 0
  if (input.discountType === 'percent') {
    discountAmount = (subtotal * Math.max(0, input.discountValue || 0)) / 100
  } else {
    discountAmount = Math.max(0, input.discountValue || 0)
  }
  discountAmount = Math.min(discountAmount, subtotal) // can't exceed subtotal

  const afterDiscount = subtotal - discountAmount

  // Tax on the discounted amount
  const taxAmount = (afterDiscount * Math.max(0, input.taxRate || 0)) / 100

  const total = Math.max(0, afterDiscount + taxAmount)

  // Round to 2 decimals
  const round = (n: number) => Math.round(n * 100) / 100

  return {
    consultationFee: round(consultationFee),
    medicineCharges: round(medicineCharges),
    labCharges: round(labCharges),
    otherCharges: round(otherCharges),
    subtotal: round(subtotal),
    discountAmount: round(discountAmount),
    taxAmount: round(taxAmount),
    total: round(total),
  }
}

/** Returns the outstanding balance for a bill. */
export function balanceDue(total: number, amountPaid: number): number {
  return Math.max(0, Math.round((total - amountPaid) * 100) / 100)
}

/** Returns the status after applying a payment of `amount` to a bill with the given total + already paid. */
export function statusAfterPayment(
  total: number,
  alreadyPaid: number,
  paymentAmount: number,
  isRefund = false,
): 'Pending' | 'Partial' | 'Paid' | 'Refunded' {
  if (isRefund) return 'Refunded'
  const newPaid = alreadyPaid + paymentAmount
  if (newPaid <= 0) return 'Pending'
  if (newPaid >= total) return 'Paid'
  return 'Partial'
}
