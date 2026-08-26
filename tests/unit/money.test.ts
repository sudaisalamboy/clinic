/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { describe, it, expect } from 'vitest'
import {
  MAX_MONEY_RUPEES,
  MAX_LINE_ITEM_PAISE,
  toPaise,
  toRupees,
  toBps,
  toPercent,
  toStoredDiscount,
  discountFromStored,
  calcBillTotals,
} from '@/lib/money'

/**
 * Unit tests for the money math — the financial heart of the system.
 *
 * All amounts are INTEGER PAISE (₹1 = 100) and rates are INTEGER BASIS
 * POINTS (1% = 100). These tests pin down:
 *  - the four arithmetic shapes of calcBillTotals (discount × GST),
 *  - clamping (discount can never exceed the subtotal; negatives are
 *    sanitized before any multiplication),
 *  - rounding at half-paise boundaries (Math.round semantics),
 *  - the MAX_LINE_ITEM_PAISE / MAX_MONEY_RUPEES caps,
 *  - the API-boundary converters and their round-trip stability.
 */

describe('calcBillTotals — basic shapes', () => {
  it('sums consultation + medicine with no discount or GST', () => {
    const t = calcBillTotals({
      consultationCharge: 5000,
      medicineCharge: 4500,
      discount: 0,
      discountType: 'fixed',
      gst: 0,
    })
    expect(t).toEqual({
      medicineCharge: 4500,
      discountAmount: 0,
      gstAmount: 0,
      grandTotal: 9500,
    })
  })

  it('applies a fixed (₹) discount', () => {
    const t = calcBillTotals({
      consultationCharge: 5000,
      medicineCharge: 4500,
      discount: 500,
      discountType: 'fixed',
      gst: 0,
    })
    expect(t.discountAmount).toBe(500)
    expect(t.grandTotal).toBe(9000)
  })

  it('applies a percent discount (basis points)', () => {
    const t = calcBillTotals({
      consultationCharge: 5000,
      medicineCharge: 5000,
      discount: 1000, // 10%
      discountType: 'percent',
      gst: 0,
    })
    expect(t.discountAmount).toBe(1000)
    expect(t.grandTotal).toBe(9000)
  })

  it('applies GST on the undiscounted subtotal', () => {
    const t = calcBillTotals({
      consultationCharge: 10000,
      medicineCharge: 0,
      discount: 0,
      discountType: 'fixed',
      gst: 1800, // 18%
    })
    expect(t.gstAmount).toBe(1800)
    expect(t.grandTotal).toBe(11800)
  })

  it('chains percent discount THEN GST (discount reduces the taxable base)', () => {
    const t = calcBillTotals({
      consultationCharge: 10000,
      medicineCharge: 0,
      discount: 1000, // 10%
      discountType: 'percent',
      gst: 1800, // 18%
    })
    // 10000 − 1000 = 9000; GST 18% of 9000 = 1620.
    expect(t.discountAmount).toBe(1000)
    expect(t.gstAmount).toBe(1620)
    expect(t.grandTotal).toBe(10620)
  })
})

describe('calcBillTotals — the 100% discount edge', () => {
  it('100% discount + GST yields a zero total (GST on zero is zero)', () => {
    const t = calcBillTotals({
      consultationCharge: 7000,
      medicineCharge: 3000,
      discount: 10000, // 100%
      discountType: 'percent',
      gst: 1800,
    })
    expect(t.discountAmount).toBe(10000)
    expect(t.gstAmount).toBe(0)
    expect(t.grandTotal).toBe(0)
  })

  it('fixed discount larger than the subtotal is clamped to the subtotal', () => {
    const t = calcBillTotals({
      consultationCharge: 2000,
      medicineCharge: 1000,
      discount: 999_999,
      discountType: 'fixed',
      gst: 0,
    })
    expect(t.discountAmount).toBe(3000)
    expect(t.grandTotal).toBe(0)
  })

  it('percent discount above 100% is clamped to the subtotal', () => {
    const t = calcBillTotals({
      consultationCharge: 4000,
      medicineCharge: 0,
      discount: 15000, // 150%
      discountType: 'percent',
      gst: 1800,
    })
    expect(t.discountAmount).toBe(4000)
    expect(t.grandTotal).toBe(0)
  })
})

describe('calcBillTotals — rounding at half-paise boundaries', () => {
  it('rounds a percent discount that does not divide evenly (99.9 → 100)', () => {
    const t = calcBillTotals({
      consultationCharge: 999,
      medicineCharge: 0,
      discount: 1000, // 10% of 999 = 99.9 paise
      discountType: 'percent',
      gst: 0,
    })
    expect(t.discountAmount).toBe(100)
    expect(t.grandTotal).toBe(899)
  })

  it('rounds GST that does not divide evenly (161.82 → 162)', () => {
    const t = calcBillTotals({
      consultationCharge: 899,
      medicineCharge: 0,
      discount: 0,
      discountType: 'fixed',
      gst: 1800, // 18% of 899 = 161.82 paise
    })
    expect(t.gstAmount).toBe(162)
    expect(t.grandTotal).toBe(1061)
  })

  it('rounds fractional paise inputs before computing (100.6 → 101)', () => {
    const t = calcBillTotals({
      consultationCharge: 100.6,
      medicineCharge: 50.4,
      discount: 0,
      discountType: 'fixed',
      gst: 0,
    })
    // 101 + 50 — inputs are coerced to integers first.
    expect(t.grandTotal).toBe(151)
  })
})

describe('calcBillTotals — sanitization', () => {
  it('zero everywhere yields zero everywhere', () => {
    const t = calcBillTotals({
      consultationCharge: 0,
      medicineCharge: 0,
      discount: 0,
      discountType: 'fixed',
      gst: 0,
    })
    expect(t).toEqual({ medicineCharge: 0, discountAmount: 0, gstAmount: 0, grandTotal: 0 })
  })

  it('negative charges are clamped to zero (never pay the patient)', () => {
    const t = calcBillTotals({
      consultationCharge: -5000,
      medicineCharge: -4500,
      discount: -1000,
      discountType: 'fixed',
      gst: 0,
    })
    expect(t.grandTotal).toBe(0)
    expect(t.discountAmount).toBe(0)
  })

  it('negative GST is ignored (no negative tax credit)', () => {
    const t = calcBillTotals({
      consultationCharge: 10000,
      medicineCharge: 0,
      discount: 0,
      discountType: 'fixed',
      gst: -1800,
    })
    expect(t.gstAmount).toBe(0)
    expect(t.grandTotal).toBe(10000)
  })

  it('negative percent discount is ignored', () => {
    const t = calcBillTotals({
      consultationCharge: 10000,
      medicineCharge: 0,
      discount: -500,
      discountType: 'percent',
      gst: 0,
    })
    expect(t.discountAmount).toBe(0)
    expect(t.grandTotal).toBe(10000)
  })
})

describe('calcBillTotals — boundary caps', () => {
  it('handles the MAX_LINE_ITEM_PAISE boundary without overflow', () => {
    // ₹10,000,000 in paise — the largest single amount the API accepts.
    const t = calcBillTotals({
      consultationCharge: MAX_LINE_ITEM_PAISE,
      medicineCharge: 0,
      discount: 0,
      discountType: 'fixed',
      gst: 1800,
    })
    expect(t.grandTotal).toBe(1_180_000_000)
    expect(Number.isSafeInteger(t.grandTotal)).toBe(true)
  })

  it('MAX_MONEY_RUPEES and MAX_LINE_ITEM_PAISE stay in sync (₹ × 100)', () => {
    expect(MAX_LINE_ITEM_PAISE).toBe(MAX_MONEY_RUPEES * 100)
    expect(MAX_MONEY_RUPEES).toBe(10_000_000)
  })
})

describe('money converters (API boundary)', () => {
  it('toPaise converts rupees to paise', () => {
    expect(toPaise(123.45)).toBe(12345)
    expect(toPaise(0)).toBe(0)
    expect(toPaise(1)).toBe(100)
  })

  it('toPaise rounds the exact half-paise (₹0.005 → 1 paise, ₹0.004 → 0)', () => {
    // The classic ₹0.005 drift case that Float arithmetic gets wrong.
    expect(toPaise(0.005)).toBe(1)
    expect(toPaise(0.004)).toBe(0)
    expect(toPaise(0.015)).toBe(2) // 1.5 → rounds to 2
  })

  it('toRupees is the exact inverse of toPaise for 2-decimal values', () => {
    for (const rupees of [0, 0.01, 12.34, 999.99, 10_000_000]) {
      expect(toRupees(toPaise(rupees))).toBe(rupees)
    }
  })

  it('toBps / toPercent convert percent ↔ basis points', () => {
    expect(toBps(18)).toBe(1800)
    expect(toBps(0.25)).toBe(25)
    expect(toPercent(1800)).toBe(18)
    expect(toPercent(25)).toBe(0.25)
  })

  it('toStoredDiscount picks paise vs basis points by type; discountFromStored inverts it', () => {
    expect(toStoredDiscount(50, 'fixed')).toBe(5000) // ₹50 → 5000 paise
    expect(toStoredDiscount(10, 'percent')).toBe(1000) // 10% → 1000 bps
    expect(discountFromStored(5000, 'fixed')).toBe(50)
    expect(discountFromStored(1000, 'percent')).toBe(10)
  })

  it('toPaise tolerates non-numeric garbage instead of producing NaN', () => {
    expect(toPaise(Number.NaN)).toBe(0)
    expect(toPaise(undefined as unknown as number)).toBe(0)
  })
})
