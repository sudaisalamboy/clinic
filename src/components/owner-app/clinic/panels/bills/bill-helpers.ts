/** Bill-specific helpers shared across billing views. */

import { calculateBill, type LineItem, type BillCalcInput } from '@/lib/bill-calc'

export type BillStatus = 'Pending' | 'Partial' | 'Paid' | 'Refunded'

export const ALL_BILL_STATUSES: BillStatus[] = ['Pending', 'Partial', 'Paid', 'Refunded']

export const BILL_STATUS_META: Record<BillStatus, { cls: string; dotCls: string }> = {
  Pending: {
    cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5',
    dotCls: 'bg-amber-500',
  },
  Partial: {
    cls: 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/5',
    dotCls: 'bg-sky-500',
  },
  Paid: {
    cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
    dotCls: 'bg-emerald-500',
  },
  Refunded: {
    cls: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5',
    dotCls: 'bg-rose-500',
  },
}

export const PAYMENT_METHODS = ['Cash', 'Card', 'Online'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_META: Record<PaymentMethod, { cls: string; icon: string }> = {
  Cash: { cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5', icon: 'banknote' },
  Card: { cls: 'border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/5', icon: 'credit-card' },
  Online: { cls: 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/5', icon: 'globe' },
}

/** Compute live totals from form state. */
export function computeBillTotals(input: BillCalcInput) {
  return calculateBill(input)
}

export function balanceDue(total: number, amountPaid: number): number {
  return Math.max(0, Math.round((total - amountPaid) * 100) / 100)
}

export interface BillListItem {
  id: string
  billNumber: string
  total: number
  amountPaid: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  status: BillStatus
  paymentMethod: string | null
  createdAt: string
  patient: { id: string; name: string; patientCode: string; phone: string | null }
  doctor: { id: string; name: string; specialization: string | null } | null
  items: LineItem[]
  _count: { payments: number }
}

export interface BillDetail extends BillListItem {
  consultationFee: number
  medicineCharges: number
  labCharges: number
  otherCharges: number
  discountType: 'percent' | 'fixed'
  discountValue: number
  taxRate: number
  notes: string | null
  patient: {
    id: string
    name: string
    patientCode: string
    phone: string | null
    email: string | null
    dateOfBirth: string | null
    gender: string | null
    bloodGroup: string | null
    address: string | null
  }
  doctor: {
    id: string
    name: string
    specialization: string | null
    department?: { name: string } | null
  } | null
  appointment: { id: string; scheduledAt: string; reason: string | null; tokenNumber: string | null } | null
  payments: PaymentRecord[]
}

export interface PaymentRecord {
  id: string
  amount: number
  method: PaymentMethod
  type: 'payment' | 'refund'
  note: string | null
  createdAt: string
}
