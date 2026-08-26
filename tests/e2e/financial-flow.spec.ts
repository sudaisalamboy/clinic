import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * Financial golden path — the highest-risk flow in the system.
 *
 * Covers the exact loopholes called out in the security review:
 *  1. Server-authoritative pricing (client price tampering is ignored)
 *  2. Atomic stock decrement on billing (never negative, always exact)
 *  3. Insufficient stock rejected cleanly
 *  4. Paid bills are immutable (discount tampering returns 403)
 *  5. Voiding restores stock and KEEPS the record (never a hard delete)
 *  6. 'return' stock movements ADD stock (not subtract)
 *  7. 'adjust' sets the absolute level
 *
 * Runs before smoke.spec.ts (alphabetical file order, single worker) so the
 * shared session is still valid — the logout test lives in smoke.spec.ts.
 */

test.describe('Financial flow integrity', () => {
  test('billing golden path: pricing, stock, immutability, void+restore', async ({ request }) => {
    // ---- 1. Create an inventory item (admin session) ----
    const catsRes = await request.get('/api/inventory/categories')
    expect(catsRes.status()).toBe(200)
    const cats = await catsRes.json()
    expect(Array.isArray(cats) && cats.length).toBeGreaterThan(0)

    const itemRes = await request.post('/api/inventory/items', {
      data: {
        name: `E2E Paracetamol ${Date.now()}`,
        categoryId: cats[0].id,
        quantity: 100,
        minStock: 10,
        purchasePrice: 10,
        sellingPrice: 25.5,
        mrp: 30,
        gst: 5,
      },
    })
    expect(itemRes.status()).toBe(200)
    const item = await itemRes.json()
    // API speaks rupees / percent — money round-trips exactly.
    expect(item.sellingPrice).toBe(25.5)
    expect(item.mrp).toBe(30)
    expect(item.gst).toBe(5)
    expect(item.quantity).toBe(100)

    // ---- 2. Stock in: +50 → 150 ----
    const stockRes = await request.post('/api/inventory/stock', {
      data: { itemId: item.id, type: 'in', quantity: 50, note: 'e2e delivery' },
    })
    expect(stockRes.status()).toBe(200)
    const stockBody = await stockRes.json()
    expect(stockBody.item.quantity).toBe(150)

    // ---- 3. Stock out beyond availability is rejected atomically ----
    const overOut = await request.post('/api/inventory/stock', {
      data: { itemId: item.id, type: 'out', quantity: 99999 },
    })
    expect(overOut.status()).toBe(400)
    const afterOverOut = await (await request.get(`/api/inventory/items/${item.id}`)).json()
    expect(afterOverOut.quantity).toBe(150) // unchanged

    // ---- 4. Create a bill with a tampered price (0.01) ----
    // Snapshot today's revenue BEFORE the bill exists — the void-exclusion
    // check at the end asserts the DELTA, so the test stays correct on a
    // re-used e2e DB (full-workflow.spec.ts leaves paid bills behind).
    const revenueBefore = (
      await (await request.get('/api/reports')).json()
    ).dailyRevenue.at(-1).revenue
    const billRes = await request.post('/api/bills', {
      data: {
        patientName: 'E2E Patient',
        consultationCharge: 100,
        items: [{ itemId: item.id, name: item.name, qty: 10, price: 0.01 }],
        discount: 0,
        discountType: 'fixed',
        gst: 0,
        paymentMethod: 'Cash',
        paymentStatus: 'Pending',
      },
    })
    expect(billRes.status()).toBe(200)
    const bill = await billRes.json()
    // Server-authoritative price: the tampered 0.01 was ignored.
    expect(bill.items[0].price).toBe(25.5)
    expect(bill.medicineCharge).toBe(255)
    expect(bill.consultationCharge).toBe(100)
    expect(bill.grandTotal).toBe(355)

    // ---- 5. Stock decremented exactly by billed qty → 140 ----
    const afterBill = await (await request.get(`/api/inventory/items/${item.id}`)).json()
    expect(afterBill.quantity).toBe(140)

    // ---- 6. Billing beyond stock fails with a friendly error ----
    const overBill = await request.post('/api/bills', {
      data: {
        patientName: 'E2E Patient',
        consultationCharge: 0,
        items: [{ itemId: item.id, name: item.name, qty: 5000, price: 25.5 }],
        discount: 0,
        discountType: 'fixed',
        gst: 0,
        paymentMethod: 'Cash',
        paymentStatus: 'Pending',
      },
    })
    expect(overBill.status()).toBe(400)
    expect((await overBill.json()).error).toMatch(/insufficient stock/i)
    // Stock unchanged by the failed bill.
    const afterFailedBill = await (await request.get(`/api/inventory/items/${item.id}`)).json()
    expect(afterFailedBill.quantity).toBe(140)

    // ---- 7. Mark paid, then attempt to tamper with the paid bill ----
    const paidRes = await request.put(`/api/bills/${bill.id}`, {
      data: { paymentStatus: 'Paid' },
    })
    expect(paidRes.status()).toBe(200)
    expect((await paidRes.json()).paymentStatus).toBe('Paid')

    const tamperRes = await request.put(`/api/bills/${bill.id}`, {
      data: { discount: 100, discountType: 'percent' },
    })
    expect(tamperRes.status()).toBe(403)
    expect((await tamperRes.json()).error).toMatch(/immutable/i)
    // Total untouched by the rejected tamper attempt.
    const afterTamper = await (await request.get(`/api/bills/${bill.id}`)).json()
    expect(afterTamper.grandTotal).toBe(355)

    // ---- 8. Void the bill (admin) → stock restored, record kept ----
    const voidRes = await request.delete(`/api/bills/${bill.id}`)
    expect(voidRes.status()).toBe(200)
    expect((await voidRes.json()).voided).toBe(true)

    const afterVoid = await (await request.get(`/api/inventory/items/${item.id}`)).json()
    expect(afterVoid.quantity).toBe(150)

    const voidedBill = await (await request.get(`/api/bills/${bill.id}`)).json()
    expect(voidedBill.voidedAt).toBeTruthy()
    // A voided bill cannot be modified further.
    const editVoided = await request.put(`/api/bills/${bill.id}`, {
      data: { notes: 'sneaky edit' },
    })
    expect(editVoided.status()).toBe(403)

    // ---- 9. 'return' ADDS stock (the old bug subtracted) ----
    const returnRes = await request.post('/api/inventory/stock', {
      data: { itemId: item.id, type: 'return', quantity: 5, note: 'patient return' },
    })
    expect(returnRes.status()).toBe(200)
    expect((await returnRes.json()).item.quantity).toBe(155)

    // ---- 10. 'adjust' sets the ABSOLUTE level ----
    const adjustRes = await request.post('/api/inventory/stock', {
      data: { itemId: item.id, type: 'adjust', quantity: 60, note: 'stock take' },
    })
    expect(adjustRes.status()).toBe(200)
    expect((await adjustRes.json()).item.quantity).toBe(60)

    // ---- 11. Direct quantity manipulation via PUT is rejected ----
    const qtyPut = await request.put(`/api/inventory/items/${item.id}`, {
      data: { quantity: 99999 },
    })
    expect(qtyPut.status()).toBe(200)
    const afterQtyPut = await (await request.get(`/api/inventory/items/${item.id}`)).json()
    expect(afterQtyPut.quantity).toBe(60) // unchanged — quantity not updatable

    // ---- 12. Voided bills are excluded from revenue ----
    const reportsRes = await request.get('/api/reports')
    expect(reportsRes.status()).toBe(200)
    const reports = await reportsRes.json()
    const today = reports.dailyRevenue[reports.dailyRevenue.length - 1]
    // The voided bill (₹355, paid) contributed NOTHING to today's revenue:
    // the mark-paid +355 was exactly undone by the void. (Delta-based so
    // re-runs against a used e2e DB with leftover paid bills stay green.)
    expect(today.revenue).toBe(revenueBefore)
  })

  test('unauthenticated stock movement is rejected', async () => {
    const ctx = await playwrightRequest.newContext({ storageState: undefined })
    const res = await ctx.post('/api/inventory/stock', {
      data: { itemId: 'anything', type: 'in', quantity: 1 },
    })
    expect(res.status()).toBe(401)
    await ctx.dispose()
  })

  // ---------- Concurrency regression tests ----------
  //
  // These reproduce the TOCTOU races found in review: check-then-act gaps
  // where two simultaneous requests both passed the guard. The fixes move
  // the guard into a conditional UPDATE inside a transaction, so exactly
  // one request can ever win.

  test('double-void race: exactly one winner, stock restored exactly once', async ({ request }) => {
    // Fresh item: 100 units.
    const cats = await (await request.get('/api/inventory/categories')).json()
    const item = await (
      await request.post('/api/inventory/items', {
        data: {
          name: `E2E Race Item ${Date.now()}`,
          categoryId: cats[0].id,
          quantity: 100,
          minStock: 10,
          sellingPrice: 10,
        },
      })
    ).json()

    // Bill 10 units → stock drops to 90.
    const bill = await (
      await request.post('/api/bills', {
        data: {
          patientName: 'E2E Race Patient',
          consultationCharge: 0,
          items: [{ itemId: item.id, name: item.name, qty: 10, price: 10 }],
          paymentStatus: 'Pending',
        },
      })
    ).json()

    // Two admins void the SAME bill at the same time.
    const [a, b] = await Promise.all([
      request.delete(`/api/bills/${bill.id}`),
      request.delete(`/api/bills/${bill.id}`),
    ])
    const statuses = [a.status(), b.status()].sort()
    // Exactly one void succeeds; the loser gets a clean 400, never a 500.
    expect(statuses).toEqual([200, 400])
    if (a.status() === 400) expect((await a.json()).error).toMatch(/already voided/i)
    if (b.status() === 400) expect((await b.json()).error).toMatch(/already voided/i)

    // Stock restored EXACTLY once: 90 → 100 (a double restore would be 110).
    const after = await (await request.get(`/api/inventory/items/${item.id}`)).json()
    expect(after.quantity).toBe(100)
  })

  test('paid/discount race: final state is never torn', async ({ request }) => {
    const cats = await (await request.get('/api/inventory/categories')).json()
    const item = await (
      await request.post('/api/inventory/items', {
        data: {
          name: `E2E Race Item 2 ${Date.now()}`,
          categoryId: cats[0].id,
          quantity: 100,
          minStock: 10,
          sellingPrice: 10,
        },
      })
    ).json()

    // ₹100 consult + 10 × ₹10 = ₹200 total, Pending.
    const bill = await (
      await request.post('/api/bills', {
        data: {
          patientName: 'E2E Race Patient 2',
          consultationCharge: 100,
          items: [{ itemId: item.id, name: item.name, qty: 10, price: 10 }],
          paymentStatus: 'Pending',
        },
      })
    ).json()

    // Mark-paid and a ₹50 discount edit hit the bill simultaneously.
    const [paidRes, discountRes] = await Promise.all([
      request.put(`/api/bills/${bill.id}`, { data: { paymentStatus: 'Paid' } }),
      request.put(`/api/bills/${bill.id}`, { data: { discount: 50, discountType: 'fixed' } }),
    ])
    for (const r of [paidRes, discountRes]) {
      // No 5xx, no phantom failures — each request resolves cleanly.
      expect([200, 403]).toContain(r.status())
    }

    const final = await (await request.get(`/api/bills/${bill.id}`)).json()
    // The payment always lands.
    expect(final.paymentStatus).toBe('Paid')
    // The stored discount and the total are always MUTUALLY CONSISTENT:
    // either the edit lost (₹200, no discount) or won before payment
    // (₹150 = 200 − 50). A torn state (discount set but total stale, or
    // vice versa) is exactly what the transactional guard prevents.
    expect([200, 150]).toContain(final.grandTotal)
    if (final.discount > 0) {
      expect(final.discount).toBe(50)
      expect(final.grandTotal).toBe(150)
    } else {
      expect(final.grandTotal).toBe(200)
    }

    // Cleanup: void the bill (also restores the stock it consumed).
    const voidRes = await request.delete(`/api/bills/${bill.id}`)
    expect([200, 400]).toContain(voidRes.status())
  })
})
