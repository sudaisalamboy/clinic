import { test, expect, request as playwrightRequest, type Page, type Locator } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

/**
 * FULL CLINIC WORKFLOW — 300+ automated actions.
 *
 * This is the big backend↔frontend integration suite: every action goes
 * through the REAL UI (dialogs, selects, tables, toasts) or the REAL API,
 * exactly the way a clinic administrator would drive the app:
 *
 *   login → settings → add doctors/nurses → pay salaries → ban staff →
 *   suppliers → inventory + stock movements → consultation fees →
 *   patients + appointments → billing (pay/void) → reports →
 *   backend connection integrity checks
 *
 * Every UI interaction and API call is counted in a shared `tally`. The
 * final test asserts the run executed AT LEAST 300 real actions, so the
 * suite can never silently shrink below the required coverage.
 *
 * Ordering: runs after financial-flow.spec.ts and before smoke.spec.ts
 * (alphabetical file order, single worker). The logout+re-login cycle in
 * the first test refreshes tests/e2e/.auth/admin.json for the remaining
 * tests, and smoke.spec.ts's final logout still works on the fresh session.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@clinic.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2eLocalAdmin1!'

/**
 * Unique suffix so the suite is safely re-runnable against a used DB.
 *
 * Persisted to tests/e2e/.run-id so it survives WORKER RESTARTS: Playwright
 * relaunches the worker process after a failed test, which would otherwise
 * re-evaluate this module and mint a fresh suffix — silently breaking every
 * cross-test data reference (doctors created in test A could no longer be
 * found by test B). The setup project (which always runs first, in its own
 * process) deletes the file so every fresh `playwright test` run starts
 * with a new id.
 */
const RUN_FILE = path.join(__dirname, '.run-id')
const RUN: string = (() => {
  try {
    return readFileSync(RUN_FILE, 'utf8').trim()
  } catch {
    const id = Date.now().toString(36)
    writeFileSync(RUN_FILE, id)
    return id
  }
})()

/** Salary period "YYYY-MM" offset by `offset` months from today. */
function monthOffset(offset: number): string {
  const d = new Date()
  d.setDate(1) // avoid month-overflow edge (Jan 31 + 1mo)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const M0 = monthOffset(0)
const M1 = monthOffset(-1)

// Shared entity names (used across tests via module scope — single worker).
const DOCTOR_1 = `Dr. A P Sharma ${RUN}`
const DOCTOR_2 = `Dr. Meera Nair ${RUN}`
const DOCTOR_3 = `Dr. Vikram Rao ${RUN}`
const NURSE_1 = `Nurse Priya ${RUN}`
const RECEPTIONIST_1 = `Receptionist Anil ${RUN}`
const ITEM_1 = `Paracetamol 500mg ${RUN}`
const ITEM_2 = `Amoxicillin 250mg ${RUN}`
const ITEM_3 = `Surgical Gloves ${RUN}`
const ITEM_4 = `Cough Syrup ${RUN}`
const SUPPLIER_1 = `MediSupply Co ${RUN}`
const PATIENT_1 = `Ravi Kumar ${RUN}`
const PATIENT_2 = `Sita Devi ${RUN}`

// ---------- Action tally ----------
//
// A "real action" is something a user does: a click, a keystroke fill, a
// select choice, a page navigation, or an API request issued by the test.
// Assertions are NOT counted — only genuine interactions.
class Tally {
  n = 0
  async click(loc: Locator) {
    this.n++
    await loc.click()
  }
  async fill(loc: Locator, value: string) {
    this.n++
    await loc.fill(value)
  }
  /** Open a Radix select and pick an option (2 actions). Exact matching so
   *  'Male' never matches 'Female' (Playwright names are substring +
   *  case-insensitive by default). */
  async choose(page: Page, trigger: Locator, option: string | RegExp) {
    this.n++
    await trigger.click()
    this.n++
    await page.getByRole('option', { name: option, exact: true }).click()
  }
  bump(k = 1) {
    this.n += k
  }
}
const tally = new Tally()

// ---------- Selector helpers ----------
//
// Panel dialogs use plain <Label>text</Label> next to the input (no
// htmlFor), so we locate the wrapper div whose DIRECT label child matches
// the exact text, then grab the input/textarea inside it.
const area = (scope: Locator | Page, label: string): Locator =>
  scope.locator(`div:has(> label:text-is("${label}"))`).first()

const field = (scope: Locator | Page, label: string): Locator =>
  area(scope, label).locator('input, textarea').first()

const dialog = (page: Page): Locator => page.getByRole('dialog')

const row = (page: Page, text: string | RegExp): Locator =>
  page.getByRole('row').filter({ hasText: text }).first()

const alert = (page: Page): Locator => page.getByRole('alertdialog')

async function nav(page: Page, label: string) {
  await tally.click(page.locator('aside').getByRole('button', { name: label, exact: true }))
  await expect(
    page.getByRole('heading', { name: label, exact: true }).first(),
  ).toBeVisible()
}

// =====================================================================
// 1. LOGIN CYCLE — logout the setup session, log back in through the UI
// =====================================================================
test.describe('Full workflow', () => {
  test.setTimeout(150_000)

  test('login cycle: logout then fresh sign-in through the UI', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

    // Logout via the user dropdown.
    await tally.click(page.getByRole('button', { name: /Admin/ }).first())
    await tally.click(page.getByRole('menuitem', { name: 'Logout' }))
    await expect(page.getByText('Clinic Login')).toBeVisible({ timeout: 10_000 })

    // Log back in through the real form.
    await tally.fill(page.getByLabel('Email'), ADMIN_EMAIL)
    await tally.fill(page.getByLabel('Password'), ADMIN_PASSWORD)
    await tally.click(page.getByRole('button', { name: 'Sign In' }))
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // Persist the FRESH session for the remaining tests in this file and
    // for smoke.spec.ts (the old JWT was revoked by the logout above).
    await page.context().storageState({ path: 'tests/e2e/.auth/admin.json' })
  })

  // =====================================================================
  // 2. NAVIGATION SWEEP — visit every module in the app
  // =====================================================================
  test('navigate every module of the app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    for (const label of [
      'Appointments', 'Billing', 'Inventory', 'Suppliers', 'Staff',
      'Consultation', 'Reports', 'Settings', 'Dashboard',
    ]) {
      await nav(page, label)
    }
  })

  // =====================================================================
  // 3. SETTINGS — update the clinic profile and verify persistence
  // =====================================================================
  test('settings: update clinic profile and verify it persists', async ({ page }) => {
    await page.goto('/')
    await nav(page, 'Settings')
    await expect(page.getByText('Clinic Name', { exact: true })).toBeVisible()

    await tally.fill(field(page, 'Clinic Name'), `City Care Clinic ${RUN}`)
    await tally.fill(field(page, 'Doctor Name'), 'Dr. Sudais Alam')
    await tally.fill(field(page, 'Mobile'), '+91 98765 43210')
    await tally.fill(field(page, 'Email'), 'care@citycare.example')
    await tally.fill(field(page, 'GST Number'), '27AABCU9603R1ZX')
    await tally.fill(field(page, 'Currency Symbol'), '₹')
    await tally.fill(field(page, 'Timezone'), 'Asia/Kolkata')
    await tally.fill(area(page, 'Address').locator('textarea'), '12 MG Road, Bengaluru')
    await tally.click(page.getByRole('button', { name: 'Save All Changes' }))
    // exact: avoids the aria-live echo ("Notification Settings saved").
    await expect(page.getByText('Settings saved', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    // Reload and re-enter settings — the value must have round-tripped
    // through the backend.
    await page.reload()
    tally.bump()
    await nav(page, 'Settings')
    await expect(field(page, 'Clinic Name')).toHaveValue(`City Care Clinic ${RUN}`)
    await expect(field(page, 'GST Number')).toHaveValue('27AABCU9603R1ZX')
  })

  // =====================================================================
  // 4. STAFF — add doctors/nurses/receptionists, edit, ban (soft-delete)
  // =====================================================================
  test('staff: add doctors & nurses, edit salary, ban two members', async ({ page }) => {
    await page.goto('/')
    await nav(page, 'Staff')

    const addStaff = async (name: string, role: string, salary: string, extra?: { mobile?: string; email?: string; dept?: string; gender?: string }) => {
      await tally.click(page.getByRole('button', { name: 'Add Staff' }))
      const d = dialog(page)
      await expect(d).toBeVisible()
      await tally.fill(field(d, 'Name *'), name)
      if (extra?.mobile) await tally.fill(field(d, 'Mobile'), extra.mobile)
      if (extra?.email) await tally.fill(field(d, 'Email'), extra.email)
      if (extra?.dept) await tally.fill(field(d, 'Department'), extra.dept)
      await tally.fill(field(d, 'Salary (₹)'), salary)
      if (extra?.gender) {
        await tally.choose(page, area(d, 'Gender').getByRole('combobox'), extra.gender)
      }
      if (role !== 'Doctor') {
        await tally.choose(page, area(d, 'Role').getByRole('combobox'), role)
      }
      await tally.click(d.getByRole('button', { name: 'Save' }))
      await expect(d).toBeHidden()
      await expect(row(page, name)).toBeVisible({ timeout: 10_000 })
    }

    await addStaff(DOCTOR_1, 'Doctor', '85000', {
      mobile: '+91 90000 00001', email: `sharma.${RUN}@clinic.example`, dept: 'General Medicine', gender: 'Male',
    })
    await addStaff(DOCTOR_2, 'Doctor', '90000', {
      mobile: '+91 90000 00002', email: `meera.${RUN}@clinic.example`, dept: 'Pediatrics', gender: 'Female',
    })
    await addStaff(DOCTOR_3, 'Doctor', '105000', {
      mobile: '+91 90000 00003', email: `vikram.${RUN}@clinic.example`, dept: 'Orthopedics', gender: 'Male',
    })
    await addStaff(NURSE_1, 'Nurse', '30000', {
      mobile: '+91 90000 00004', dept: 'Nursing', gender: 'Female',
    })
    await addStaff(RECEPTIONIST_1, 'Receptionist', '22000', {
      mobile: '+91 90000 00005', dept: 'Front Desk', gender: 'Male',
    })

    // Edit: give Dr. Sharma a raise (85000 → 95000).
    await tally.click(row(page, DOCTOR_1).getByRole('button', { name: `Edit ${DOCTOR_1}` }))
    const editDialog = dialog(page)
    await expect(editDialog).toBeVisible()
    await expect(editDialog.getByText('Edit Staff')).toBeVisible()
    await tally.fill(field(editDialog, 'Salary (₹)'), '95000')
    await tally.click(editDialog.getByRole('button', { name: 'Save' }))
    await expect(editDialog).toBeHidden()
    await expect(row(page, DOCTOR_1).getByText('₹95,000')).toBeVisible({ timeout: 10_000 })

    // Ban two members (soft-delete → Inactive, history preserved).
    const ban = async (name: string) => {
      await tally.click(row(page, name).getByRole('button', { name: `Delete ${name}` }))
      const a = alert(page)
      await expect(a).toBeVisible()
      await tally.click(a.getByRole('button', { name: 'Delete' }))
      await expect(a).toBeHidden()
      await expect(row(page, name).getByText('Inactive')).toBeVisible({ timeout: 10_000 })
    }
    await ban(DOCTOR_3) // banned doctor — payroll rejection tested later
    await ban(RECEPTIONIST_1)

    // Search filter.
    await tally.fill(page.getByPlaceholder('Search staff...'), 'Meera')
    await expect(row(page, DOCTOR_2)).toBeVisible()
    await tally.fill(page.getByPlaceholder('Search staff...'), '')

    // Profile view shows the Pay Salary action.
    await tally.click(row(page, DOCTOR_2).getByText(DOCTOR_2))
    await expect(page.getByText('Recent Appointments')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Pay Salary' })).toBeVisible()
    await tally.click(page.getByRole('button', { name: 'Back to Staff List' }))
  })

  // =====================================================================
  // 5. PAYROLL — give salaries, double-pay guard, entry deletion
  // =====================================================================
  test('payroll: give salaries, reject double-pay, delete an entry', async ({ page }) => {
    await page.goto('/')
    await nav(page, 'Staff')

    const paySalary = async (name: string, month: string, amount?: string, method?: string) => {
      await tally.click(row(page, name).getByRole('button', { name: `Pay salary to ${name}` }))
      const d = dialog(page)
      await expect(d).toBeVisible()
      await tally.fill(d.getByLabel('Month (YYYY-MM) *'), month)
      if (amount) await tally.fill(d.getByLabel(/Amount/), amount)
      if (method) await tally.choose(page, area(d, 'Method').getByRole('combobox'), method)
      await tally.click(d.getByRole('button', { name: /^Pay/ }))
      await expect(page.getByText('Salary paid', { exact: true }).first()).toBeVisible({
        timeout: 10_000,
      })
      await expect(d.getByRole('row').filter({ hasText: month })).toBeVisible({ timeout: 10_000 })
      // Close the modal — its overlay blocks the row buttons needed for the
      // next payment. (.last(): the dialog has TWO 'Close' buttons — the
      // Radix header X and our footer button.)
      await tally.click(d.getByRole('button', { name: 'Close' }).last())
      await expect(d).toBeHidden()
    }

    // Dr. Sharma: two consecutive months (95,000 each after the raise).
    await paySalary(DOCTOR_1, M1)
    await paySalary(DOCTOR_1, M0)
    // Dr. Meera: last month via UPI.
    await paySalary(DOCTOR_2, M1, '90000', 'UPI')
    // Nurse Priya: last month via Bank Transfer.
    await paySalary(NURSE_1, M1, '30000', 'Bank Transfer')

    // Total paid for Dr. Sharma: 95,000 × 2 = ₹1,90,000 (en-IN grouping).
    await tally.click(row(page, DOCTOR_1).getByRole('button', { name: `Pay salary to ${DOCTOR_1}` }))
    const d1 = dialog(page)
    await expect(d1).toBeVisible()
    await expect(d1.getByText(/1,90,000/)).toBeVisible({ timeout: 10_000 })

    // Double-pay guard: re-paying M1 for Dr. Meera must be rejected.
    await tally.click(d1.getByRole('button', { name: 'Close' }).last())
    await tally.click(row(page, DOCTOR_2).getByRole('button', { name: `Pay salary to ${DOCTOR_2}` }))
    const d2 = dialog(page)
    await expect(d2).toBeVisible()
    await tally.fill(d2.getByLabel('Month (YYYY-MM) *'), M1)
    await tally.click(d2.getByRole('button', { name: /^Pay/ }))
    await expect(page.getByText('already paid')).toBeVisible({ timeout: 10_000 })

    // Delete one payroll entry (the M1 payment of Dr. Sharma).
    await tally.click(d2.getByRole('button', { name: 'Close' }).last())
    await tally.click(row(page, DOCTOR_1).getByRole('button', { name: `Pay salary to ${DOCTOR_1}` }))
    const d3 = dialog(page)
    await expect(d3).toBeVisible()
    await tally.click(d3.getByRole('button', { name: `Delete salary entry ${M1}` }))
    const a = alert(page)
    await expect(a).toBeVisible()
    await tally.click(a.getByRole('button', { name: 'Delete' }))
    // exact: the toast is echoed in an aria-live region as
    // "Notification Salary entry removed" — substring match hits both.
    await expect(page.getByText('Salary entry removed', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(d3.getByRole('row').filter({ hasText: M1 })).toBeHidden({ timeout: 10_000 })

    // Banned staff cannot be paid.
    await tally.click(d3.getByRole('button', { name: 'Close' }).last())
    await tally.click(row(page, DOCTOR_3).getByRole('button', { name: `Pay salary to ${DOCTOR_3}` }))
    const d4 = dialog(page)
    await expect(d4).toBeVisible()
    await tally.click(d4.getByRole('button', { name: /^Pay/ }))
    await expect(page.getByText('cannot be paid a salary')).toBeVisible({ timeout: 10_000 })
    await tally.click(d4.getByRole('button', { name: 'Close' }).last())
  })

  // =====================================================================
  // 6. SUPPLIERS — add, edit, delete
  // =====================================================================
  test('suppliers: add three, edit one, delete one', async ({ page }) => {
    await page.goto('/')
    await nav(page, 'Suppliers')

    const addSupplier = async (name: string, supplies: string, mobile: string) => {
      await tally.click(page.getByRole('button', { name: 'Add Supplier' }))
      const d = dialog(page)
      await expect(d).toBeVisible()
      await tally.fill(field(d, 'Name *'), name)
      await tally.fill(field(d, 'Mobile'), mobile)
      await tally.fill(field(d, 'Supplies'), supplies)
      await tally.click(d.getByRole('button', { name: 'Save' }))
      await expect(d).toBeHidden()
      await expect(row(page, name)).toBeVisible({ timeout: 10_000 })
    }
    await addSupplier(SUPPLIER_1, 'Tablets & syrups', '+91 80000 00001')
    await addSupplier(`PharmaDirect ${RUN}`, 'Antibiotics', '+91 80000 00002')
    await addSupplier(`HealthMart Traders ${RUN}`, 'Surgical consumables', '+91 80000 00003')

    // Edit: broaden the first supplier's supplies.
    await tally.click(row(page, SUPPLIER_1).locator('button').first())
    const d = dialog(page)
    await expect(d.getByText('Edit Supplier')).toBeVisible()
    await tally.fill(field(d, 'Supplies'), 'Tablets, syrups & injectables')
    await tally.click(d.getByRole('button', { name: 'Save' }))
    await expect(d).toBeHidden()
    await expect(row(page, SUPPLIER_1).getByText('Tablets, syrups & injectables')).toBeVisible({
      timeout: 10_000,
    })

    // Delete the third supplier (hard delete — row disappears).
    await tally.click(row(page, `HealthMart Traders ${RUN}`).locator('button').nth(1))
    const a = alert(page)
    await expect(a).toBeVisible()
    await tally.click(a.getByRole('button', { name: 'Delete' }))
    await expect(a).toBeHidden()
    await expect(row(page, `HealthMart Traders ${RUN}`)).toBeHidden({ timeout: 10_000 })

    // Search.
    await tally.fill(page.getByPlaceholder('Search suppliers...'), 'MediSupply')
    await expect(row(page, SUPPLIER_1)).toBeVisible()
    await tally.fill(page.getByPlaceholder('Search suppliers...'), '')
  })

  // =====================================================================
  // 7. INVENTORY — category, items, stock in/out/return/adjust, deactivate
  // =====================================================================
  test('inventory: items, stock movements, edit, deactivate', async ({ page }) => {
    await page.goto('/')
    await nav(page, 'Inventory')

    // New category.
    await tally.click(page.getByRole('tab', { name: 'Categories' }))
    await tally.fill(page.getByPlaceholder('New category name'), `Surgical ${RUN}`)
    await tally.click(page.getByRole('button', { name: 'Add', exact: true }))
    await expect(page.locator('span', { hasText: `Surgical ${RUN}` }).first()).toBeVisible()
    await tally.click(page.getByRole('tab', { name: 'Items' }))

    // Add items.
    const addItem = async (name: string, qty: string, purchase: string, selling: string, mrp: string, gst: string) => {
      await tally.click(page.getByRole('button', { name: 'Add Item' }))
      const d = dialog(page)
      await expect(d).toBeVisible()
      await tally.fill(field(d, 'Name *'), name)
      await tally.choose(page, area(d, 'Category *').getByRole('combobox'), `Surgical ${RUN}`)
      await tally.fill(field(d, 'Quantity'), qty)
      await tally.fill(field(d, 'Purchase Price (₹)'), purchase)
      await tally.fill(field(d, 'Selling Price (₹)'), selling)
      await tally.fill(field(d, 'MRP (₹)'), mrp)
      await tally.fill(field(d, 'GST (%)'), gst)
      await tally.click(d.getByRole('button', { name: 'Save' }))
      await expect(d).toBeHidden()
      await expect(row(page, name)).toBeVisible({ timeout: 10_000 })
    }
    await addItem(ITEM_1, '100', '10', '15', '20', '5')
    await addItem(ITEM_2, '80', '40', '60', '75', '12')
    await addItem(ITEM_3, '200', '20', '35', '45', '18')
    await addItem(ITEM_4, '50', '30', '45', '55', '5')

    // Stock movements on ITEM_1: 100 → in+50 → out−10 → return+5 → adjust 130.
    const stockMove = async (itemName: string, opener: 'Stock In' | 'Stock Out', type: 'in' | 'out' | 'return' | 'adjust', qty: string, expectedQty: string) => {
      await tally.click(row(page, itemName).getByTitle(opener))
      const d = dialog(page)
      await expect(d.getByText('Stock Movement')).toBeVisible()
      if (type === 'return') {
        await tally.choose(page, area(d, 'Movement Type').getByRole('combobox'), /^Return/)
      } else if (type === 'adjust') {
        await tally.choose(page, area(d, 'Movement Type').getByRole('combobox'), /^Adjust/)
      }
      const qtyLabel = type === 'adjust' ? 'New counted quantity *' : 'Quantity *'
      await tally.fill(field(d, qtyLabel), qty)
      await tally.click(d.getByRole('button', { name: 'Confirm' }))
      await expect(d).toBeHidden()
      await expect(row(page, itemName).getByText(expectedQty, { exact: true })).toBeVisible({
        timeout: 10_000,
      })
    }
    await stockMove(ITEM_1, 'Stock In', 'in', '50', '150')
    await stockMove(ITEM_1, 'Stock Out', 'out', '10', '140')
    await stockMove(ITEM_1, 'Stock In', 'return', '5', '145')
    await stockMove(ITEM_1, 'Stock In', 'adjust', '130', '130')

    // Stock movements on ITEM_2: 80 → in+20 = 100 → out−30 = 70.
    await stockMove(ITEM_2, 'Stock In', 'in', '20', '100')
    await stockMove(ITEM_2, 'Stock Out', 'out', '30', '70')

    // Edit ITEM_3: raise the selling price.
    await tally.click(row(page, ITEM_3).locator('button').nth(2)) // pencil (after in/out)
    const d = dialog(page)
    await expect(d.getByText('Edit Item')).toBeVisible()
    await tally.fill(field(d, 'Selling Price (₹)'), '38')
    await tally.click(d.getByRole('button', { name: 'Save' }))
    await expect(d).toBeHidden()
    await expect(row(page, ITEM_3).getByText('₹38')).toBeVisible({ timeout: 10_000 })

    // Deactivate ITEM_4 (soft — badge flips to Inactive). Row buttons are
    // [Stock In, Stock Out, Edit, Deactivate] → trash is index 3.
    await tally.click(row(page, ITEM_4).locator('button').nth(3))
    const a = alert(page)
    await expect(a).toBeVisible()
    await tally.click(a.getByRole('button', { name: 'Deactivate' }))
    await expect(a).toBeHidden()
    await expect(row(page, ITEM_4).getByText('Inactive')).toBeVisible({ timeout: 10_000 })

    // Search filter.
    await tally.fill(page.getByPlaceholder('Search items...'), 'Paracetamol')
    await expect(row(page, ITEM_1)).toBeVisible()
    await tally.fill(page.getByPlaceholder('Search items...'), '')
  })

  // =====================================================================
  // 8. CONSULTATION FEES — add, edit, delete
  // =====================================================================
  test('consultation fees: add, edit, delete', async ({ page }) => {
    await page.goto('/')
    await nav(page, 'Consultation')

    const fee1 = `Specialist Visit ${RUN}`
    const fee2 = `Follow Up ${RUN}`

    await tally.click(page.getByRole('button', { name: 'Add Fee' }))
    let d = dialog(page)
    await expect(d).toBeVisible()
    await tally.fill(field(d, 'Name'), fee1)
    await tally.fill(field(d, 'Fee (₹)'), '200')
    await tally.fill(area(d, 'Description').locator('textarea'), 'Specialist consultation')
    await tally.click(d.getByRole('button', { name: 'Save' }))
    await expect(d).toBeHidden()
    await expect(row(page, fee1)).toBeVisible({ timeout: 10_000 })

    await tally.click(page.getByRole('button', { name: 'Add Fee' }))
    d = dialog(page)
    await expect(d).toBeVisible()
    await tally.fill(field(d, 'Name'), fee2)
    await tally.fill(field(d, 'Fee (₹)'), '30')
    await tally.click(d.getByRole('button', { name: 'Save' }))
    await expect(d).toBeHidden()
    await expect(row(page, fee2)).toBeVisible({ timeout: 10_000 })

    // Edit fee2: 30 → 40.
    await tally.click(row(page, fee2).locator('button').first())
    d = dialog(page)
    await expect(d.getByText('Edit Fee')).toBeVisible()
    await tally.fill(field(d, 'Fee (₹)'), '40')
    await tally.click(d.getByRole('button', { name: 'Save' }))
    await expect(d).toBeHidden()
    await expect(row(page, fee2).getByText('₹40')).toBeVisible({ timeout: 10_000 })

    // Delete fee1.
    await tally.click(row(page, fee1).locator('button').nth(1))
    const a = alert(page)
    await expect(a).toBeVisible()
    await tally.click(a.getByRole('button', { name: 'Delete' }))
    await expect(a).toBeHidden()
    await expect(row(page, fee1)).toBeHidden({ timeout: 10_000 })
  })

  // =====================================================================
  // 9. PATIENTS + APPOINTMENTS — bulk registry + schedule & status flow
  // =====================================================================
  test('patients & appointments: bulk register, book, complete/no-show/cancel', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

    // Bulk patient registration through the backend API — each call is a
    // real request exercising the frontend↔backend connection.
    for (let i = 1; i <= 25; i++) {
      const res = await page.request.post('/api/patients', {
        data: {
          name: `Bulk Patient ${RUN}-${String(i).padStart(2, '0')}`,
          mobile: `+91 70000 ${String(10000 + i).slice(-5)}`,
          age: 20 + (i % 50),
          gender: i % 2 ? 'Male' : 'Female',
        },
      })
      tally.bump()
      expect(res.status(), `patient #${i} should be created`).toBe(200)
    }

    await nav(page, 'Appointments')

    const bookAppointment = async (patient: string, doctor: string) => {
      await tally.click(page.getByRole('button', { name: 'New', exact: true }))
      const d = dialog(page)
      await expect(d.getByText('New Appointment')).toBeVisible()
      await tally.fill(field(d, 'Patient Name *'), patient)
      await tally.fill(field(d, 'Mobile'), '+91 91234 56789')
      await tally.choose(page, area(d, 'Doctor').getByRole('combobox'), doctor)
      await tally.click(d.getByRole('button', { name: 'Save' }))
      await expect(d).toBeHidden()
      await expect(row(page, patient)).toBeVisible({ timeout: 10_000 })
    }
    const APPT_1 = `Amit Verma ${RUN}`
    const APPT_2 = `Geeta Shah ${RUN}`
    const APPT_3 = `Imran Khan ${RUN}`
    await bookAppointment(APPT_1, DOCTOR_1)
    await bookAppointment(APPT_2, DOCTOR_2)
    await bookAppointment(APPT_3, DOCTOR_2)

    // Status flow: complete #1, no-show #2, cancel #3 (cancel acts
    // immediately — the confirm dialog is only for the trash/delete action).
    await tally.click(row(page, APPT_1).getByTitle('Complete'))
    await expect(row(page, APPT_1).getByText('Completed')).toBeVisible({ timeout: 10_000 })
    await tally.click(row(page, APPT_2).getByTitle('No Show'))
    await expect(row(page, APPT_2).getByText('No Show')).toBeVisible({ timeout: 10_000 })
    await tally.click(row(page, APPT_3).getByTitle('Cancel'))
    await expect(row(page, APPT_3).getByText('Cancelled')).toBeVisible({ timeout: 10_000 })

    // Search.
    await tally.fill(page.getByPlaceholder('Search...'), 'Amit')
    await expect(row(page, APPT_1)).toBeVisible()
    await tally.fill(page.getByPlaceholder('Search...'), '')
  })

  // =====================================================================
  // 10. BILLING — bills with medicine lines, mark paid, view, void
  // =====================================================================
  test('billing: generate bills with stock deduction, pay, void with restore', async ({ page }) => {
    await page.goto('/')
    await nav(page, 'Billing')

    // Bill 1: ₹200 consult + 2 × Paracetamol(₹15) = ₹230, Pending.
    await tally.click(page.getByRole('button', { name: 'Generate Bill' }))
    let d = dialog(page)
    await expect(d.getByRole('heading', { name: 'Generate Bill' })).toBeVisible()
    await tally.fill(field(d, 'Patient Name *'), PATIENT_1)
    await tally.fill(field(d, 'Mobile'), '+91 91111 11111')
    await tally.fill(field(d, 'Consultation Charge (₹)'), '200')
    await tally.choose(
      page,
      area(d, 'Add Medicine / Item').getByRole('combobox'),
      new RegExp(ITEM_1),
    )
    await tally.fill(
      d.getByRole('row').filter({ hasText: ITEM_1 }).locator('input[type="number"]').first(),
      '2',
    )
    await tally.click(d.getByRole('button', { name: 'Generate Bill' }))
    await expect(d).toBeHidden()
    await expect(row(page, PATIENT_1).getByText('₹230')).toBeVisible({ timeout: 10_000 })

    // Bill 2: ₹100 consult + 3 × Amoxicillin(₹60) = ₹280, created as Paid.
    await tally.click(page.getByRole('button', { name: 'Generate Bill' }))
    d = dialog(page)
    await expect(d.getByRole('heading', { name: 'Generate Bill' })).toBeVisible()
    await tally.fill(field(d, 'Patient Name *'), PATIENT_2)
    await tally.fill(field(d, 'Consultation Charge (₹)'), '100')
    await tally.choose(
      page,
      area(d, 'Add Medicine / Item').getByRole('combobox'),
      new RegExp(ITEM_2),
    )
    await tally.fill(
      d.getByRole('row').filter({ hasText: ITEM_2 }).locator('input[type="number"]').first(),
      '3',
    )
    await tally.choose(page, area(d, 'Payment Status').getByRole('combobox'), 'Paid')
    await tally.click(d.getByRole('button', { name: 'Generate Bill' }))
    await expect(d).toBeHidden()
    const bill2row = row(page, PATIENT_2)
    await expect(bill2row.getByText('₹280')).toBeVisible({ timeout: 10_000 })
    await expect(bill2row.getByText('Paid', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Stock was deducted atomically: Paracetamol 130 → 128, Amoxicillin 70 → 67.
    await nav(page, 'Inventory')
    await expect(row(page, ITEM_1).getByText('128', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(row(page, ITEM_2).getByText('67', { exact: true })).toBeVisible({ timeout: 10_000 })
    await nav(page, 'Billing')

    // Mark Bill 1 paid.
    await tally.click(row(page, PATIENT_1).getByTitle('Mark Paid'))
    await expect(row(page, PATIENT_1).getByText('Paid', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    // View the receipt dialog.
    await tally.click(row(page, PATIENT_1).locator('button').first())
    const view = dialog(page)
    await expect(view.getByText('Consultation')).toBeVisible()
    await expect(view.getByText(ITEM_1).first()).toBeVisible()
    await tally.click(view.getByRole('button', { name: 'Close' }).last())

    // Void Bill 1 → stock restored (128 → 130), record kept.
    await tally.click(row(page, PATIENT_1).getByTitle('Void bill'))
    const a = alert(page)
    await expect(a.getByText('Void this bill?')).toBeVisible()
    await tally.click(a.getByRole('button', { name: 'Void Bill' }))
    await expect(a).toBeHidden()
    await expect(row(page, PATIENT_1).getByText('Voided')).toBeVisible({ timeout: 10_000 })

    await nav(page, 'Inventory')
    await expect(row(page, ITEM_1).getByText('130', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  // =====================================================================
  // 11. BACKEND CONNECTION INTEGRITY — API-level guarantees
  // =====================================================================
  test('backend connection integrity: payroll guards and data round-trips', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

    // Staff round-trip: our doctors exist with the right salaries.
    const staffRes = await page.request.get(`/api/staff?q=${encodeURIComponent(RUN)}`)
    tally.bump()
    expect(staffRes.status()).toBe(200)
    const staff = (await staffRes.json()) as Array<{
      id: string
      name: string
      salary: number
      status: string
    }>
    expect(staff.length).toBeGreaterThanOrEqual(5)
    const sharma = staff.find((s) => s.name === DOCTOR_1)
    expect(sharma?.salary).toBe(95000) // rupees (serialized from paise)
    expect(staff.find((s) => s.name === DOCTOR_3)?.status).toBe('Inactive') // banned

    // Payroll round-trip: payments exist with exact amounts.
    const payRes = await page.request.get('/api/salary-payments')
    tally.bump()
    expect(payRes.status()).toBe(200)
    const payments = (await payRes.json()) as Array<{
      amount: number; month: string; staff: { name: string }
    }>
    const ours = payments.filter((p) => p.staff?.name?.includes(RUN))
    // Dr. Sharma M0 (95,000) + Meera M1 (90,000) + Nurse M1 (30,000) = 3 left
    // (Sharma's M1 entry was deleted in the payroll test).
    expect(ours.length).toBe(3)
    expect(ours.find((p) => p.staff.name === DOCTOR_1 && p.month === M0)?.amount).toBe(95000)
    expect(ours.find((p) => p.staff.name === DOCTOR_2 && p.month === M1)?.amount).toBe(90000)

    // Double-pay is rejected with 409.
    const meera = staff.find((s) => s.name === DOCTOR_2)!
    const dupRes = await page.request.post('/api/salary-payments', {
      data: { staffId: meera.id, amount: 90000, month: M1, method: 'Cash' },
    })
    tally.bump()
    expect(dupRes.status()).toBe(409)
    expect((await dupRes.json()).error).toMatch(/already paid/i)

    // Banned staff cannot be paid (400, not a silent success).
    const vikram = staff.find((s) => s.name === DOCTOR_3)!
    const bannedRes = await page.request.post('/api/salary-payments', {
      data: { staffId: vikram.id, amount: 105000, month: M0, method: 'Cash' },
    })
    tally.bump()
    expect(bannedRes.status()).toBe(400)

    // Invalid month is rejected by validation.
    const badMonthRes = await page.request.post('/api/salary-payments', {
      data: { staffId: meera.id, amount: 100, month: '2026-99', method: 'Cash' },
    })
    tally.bump()
    expect(badMonthRes.status()).toBe(400)

    // Patients bulk round-trip.
    const patRes = await page.request.get(`/api/patients?q=${encodeURIComponent(`Bulk Patient ${RUN}`)}`)
    tally.bump()
    expect(patRes.status()).toBe(200)
    const patients = (await patRes.json()) as unknown[]
    expect(patients.length).toBe(25)

    // Reports reflect today's activity (bill revenue, staff count, etc.).
    const repRes = await page.request.get('/api/reports')
    tally.bump()
    expect(repRes.status()).toBe(200)
    const reports = await repRes.json()
    expect(Array.isArray(reports.dailyRevenue)).toBe(true)
    expect(reports.dailyRevenue.length).toBeGreaterThan(0)

    // Salary routes are authentication-protected.
    const ctx = await playwrightRequest.newContext({ storageState: undefined })
    const unauthRes = await ctx.get('/api/salary-payments')
    tally.bump()
    expect(unauthRes.status()).toBe(401)
    await ctx.dispose()
  })

  // =====================================================================
  // 12. COVERAGE — the suite must execute at least 300 REAL actions
  // =====================================================================
  test('coverage: at least 300 real actions were executed', async ({ page }) => {
    // Attach the count to the report for visibility.
    test.info().annotations.push({
      type: 'note',
      description: `Full workflow executed ${tally.n} real UI/API actions (required: ≥ 300)`,
    })
    console.log(`[full-workflow] executed ${tally.n} real actions (required ≥ 300)`)
    expect(
      tally.n,
      'the full workflow suite must execute at least 300 real actions',
    ).toBeGreaterThanOrEqual(300)

    // And the app still responds happily.
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  })
})
