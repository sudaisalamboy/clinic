import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * Test-scoped admin credentials (created by the `setup` project via
 * /api/auth/setup — see tests/e2e/auth.setup.ts). Override locally via
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD if needed.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@clinic.com'

/**
 * Every test in this file inherits the saved admin session cookie from the
 * `setup` project (see tests/e2e/auth.setup.ts + playwright.config.ts), so
 * authenticated tests start already logged in — no per-test login, which
 * avoids the in-memory login rate limiter (5 attempts/min).
 *
 * Tests that need an UNAUTHENTICATED context opt out with
 * `test.use({ storageState: undefined })`.
 *
 * NOTE on test ordering: the "logout" test is intentionally placed LAST because
 * it revokes the shared session server-side (jti blocklist), which would make
 * every later authenticated test receive 401. Playwright runs tests in file
 * order within a single-worker project, so file order = execution order
 * (financial-flow.spec.ts runs before this file).
 */

// ---------- Unauthenticated flows ----------

test.describe('Unauthenticated access', () => {
  // Empty storage state = fresh context with no cookies. (Note: `undefined`
  // does NOT override a project-level storageState — an empty object does.)
  test.use({ storageState: { cookies: [], origins: [] } })

  test('loads the login screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Clinic Login')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('rejects invalid credentials with a friendly toast', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Sign In' }).click()
    // The toast title is exactly "Login failed" (the aria-live region also
    // echoes it, so we use exact match to avoid a strict-mode violation).
    await expect(page.getByText('Login failed', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
  })
})

// ---------- Authenticated smoke flows ----------

test.describe('Authenticated app shell', () => {
  test('renders the dashboard after login', async ({ page }) => {
    // Already authenticated via shared storage state.
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible()
  })

  test('navigates between every main panel', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible()

    for (const label of [
      'Appointments',
      'Billing',
      'Inventory',
      'Suppliers',
      'Staff',
      'Consultation',
      'Reports',
      'Settings',
      'Dashboard',
    ]) {
      // Scope to the sidebar <aside> so we match the nav button, not any
      // same-named heading inside a panel.
      const sidebar = page.locator('aside')
      await sidebar.getByRole('button', { name: label, exact: true }).click()
      // The top bar shows the active panel name as an <h1>. Use exact match
      // so a heading like "No appointments yet" never collides.
      await expect(
        page.getByRole('heading', { name: label, exact: true }).first(),
      ).toBeVisible()
    }
  })

  test('settings panel renders the clinic profile form', async ({ page }) => {
    await page.goto('/')
    await page.locator('aside').getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Settings', exact: true }),
    ).toBeVisible()
    // The settings form uses a <Label>Clinic Name</Label> without htmlFor,
    // so we assert the label text is visible (proves the profile form rendered).
    await expect(page.getByText('Clinic Name', { exact: true })).toBeVisible()
  })
})

// ---------- Security regression tests ----------

test.describe('API security', () => {
  test('all protected routes return 401 with a friendly, leak-free message', async () => {
    // Fresh API context — no session cookie.
    const ctx = await playwrightRequest.newContext({ storageState: undefined })
    const routes: Array<[string, 'get' | 'post']> = [
      ['staff', 'get'],
      ['suppliers', 'get'],
      ['appointments', 'get'],
      ['bills', 'get'],
      ['patients', 'get'],
      ['inventory/items', 'get'],
      ['inventory/categories', 'get'],
      ['inventory/stock', 'post'],
      ['consultation-fees', 'get'],
      ['reports', 'get'],
      ['settings', 'get'],
    ]
    for (const [r, method] of routes) {
      const res =
        method === 'get'
          ? await ctx.get(`/api/${r}`)
          : await ctx.post(`/api/${r}`, { data: {} })
      expect(res.status(), `${method.toUpperCase()} /api/${r} should be 401`).toBe(401)
      const body = await res.json()
      expect(body.error).toBeTruthy()
      // Never leak Prisma / stack internals.
      const json = JSON.stringify(body)
      expect(json).not.toContain('Prisma')
      expect(json).not.toMatch(/\n\s*at\s/)
    }
    await ctx.dispose()
  })

  test('logout endpoint is safe when already unauthenticated', async () => {
    const ctx = await playwrightRequest.newContext({ storageState: undefined })
    const res = await ctx.post('/api/auth/logout')
    expect([200, 401]).toContain(res.status())
    const json = JSON.stringify(await res.json())
    expect(json).not.toContain('Prisma')
    expect(json).not.toMatch(/\n\s*at\s/)
    await ctx.dispose()
  })

  test('POST /api/staff validates input — zod rejects non-string name, no Prisma leak', async ({
    page,
  }) => {
    // Authenticated via shared storage state. Use page.request so the session
    // cookie is shared with the browser context.
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible()

    const res = await page.request.post('/api/staff', {
      data: { name: { $ne: null }, role: 'Doctor' },
    })
    expect([400, 422]).toContain(res.status())
    const body = await res.json()
    const json = JSON.stringify(body)
    expect(json).not.toContain('Prisma')
    expect(json).not.toContain('invoked')
  })

  test('login brute-force is rate-limited after repeated failures', async () => {
    // Isolated API context so we don't touch the page's session.
    const ctx = await playwrightRequest.newContext({ storageState: undefined })
    let saw429 = false
    for (let i = 0; i < 8; i++) {
      const res = await ctx.post('/api/auth/login', {
        data: { email: ADMIN_EMAIL, password: 'wrong' },
      })
      if (res.status() === 429) {
        saw429 = true
        const body = await res.json()
        expect(body.error).toMatch(/too many/i)
        expect(res.headers()['retry-after']).toBeTruthy()
        break
      }
    }
    expect(saw429).toBe(true)
    await ctx.dispose()
  })
})

// ---------- Logout (runs LAST — invalidates the shared session) ----------

test.describe('Session termination', () => {
  test('logout returns the user to the login screen', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible()
    // Open the user dropdown (trigger shows the admin's name).
    await page.getByRole('button', { name: 'Admin' }).first().click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await expect(page.getByText('Clinic Login')).toBeVisible({ timeout: 10_000 })
  })
})
