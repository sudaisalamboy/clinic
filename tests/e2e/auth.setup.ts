import { test as setup, expect } from '@playwright/test'
import { unlinkSync } from 'fs'
import path from 'path'

/**
 * Global setup: ensures the first admin exists (via the first-run setup
 * endpoint on an empty DB — 409 means setup was already completed), then
 * logs in through the UI once and persists the session cookie to
 * `tests/e2e/.auth/admin.json`. All downstream "chromium" project tests
 * reuse this storage state, so we never hit the in-memory login rate
 * limiter (5 attempts / minute) from repeated per-test logins.
 *
 * Credentials come from E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD:
 *  - CI generates a random per-run password (see .github/workflows/ci.yml)
 *    and passes it via env — no password is committed to the repo.
 *  - Locally the webServer (playwright.config.ts) runs against a dedicated
 *    test database (db/e2e.db), and this deterministic default is used so
 *    re-runs against an existing local e2e DB keep working.
 *
 * This project always runs FIRST (chromium depends on it), so it also
 * resets the shared run-id file used by full-workflow.spec.ts — every
 * fresh `playwright test` invocation gets a brand-new unique suffix,
 * while mid-run worker restarts keep the same one (see full-workflow).
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@clinic.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2eLocalAdmin1!'

try {
  unlinkSync(path.join(__dirname, '.run-id'))
} catch {
  // No leftover run id — first run, nothing to clean.
}

setup('ensure admin account and authenticate', async ({ request, page }) => {
  // First-run setup on an empty DB. 409 = setup already completed (the
  // DB already has accounts) — that's fine, we log in below.
  const setupRes = await request.post('/api/auth/setup', {
    data: { name: 'E2E Admin', email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  if (setupRes.status() !== 200 && setupRes.status() !== 409) {
    throw new Error(`Unexpected setup response: ${setupRes.status()} ${await setupRes.text()}`)
  }

  // Log in through the real UI — proves the login flow end-to-end — and
  // save the session cookie for all downstream tests.
  await page.goto('/')
  await expect(page.getByLabel('Email')).toBeVisible()
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await page.context().storageState({ path: 'tests/e2e/.auth/admin.json' })
})
