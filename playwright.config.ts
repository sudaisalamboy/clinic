import { randomBytes } from 'crypto'
import { mkdirSync } from 'fs'
import path from 'path'
import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for the Clinic Management System.
 *
 * Architecture:
 *  - A `setup` project creates the first admin (via /api/auth/setup on an
 *    empty DB) and logs in ONCE, saving the session cookie to
 *    `tests/e2e/.auth/admin.json`. This avoids hammering the in-memory
 *    login rate limiter (5 attempts/min) from per-test logins.
 *  - The `chromium` project depends on `setup` and reuses the saved storage
 *    state, so every authenticated test starts already logged in.
 *  - Tests that need an UNAUTHENTICATED context opt out per-test via
 *    `test.use({ storageState: undefined })`.
 *
 * Server under test:
 *  - Locally: `bun run dev` against a DEDICATED test database (db/e2e.db)
 *    so test data never pollutes the dev database.
 *  - CI: the workflow builds the production standalone server first; this
 *    config starts it (`bun run start`) with a per-run AUTH_JWT_SECRET
 *    (required in production mode).
 *
 * - Uses chromium only to keep CI fast; add projects for firefox/webkit as needed.
 */
const PORT = process.env.PORT || '3000'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`

// Treat CI env strictly: only the literal string "1" or "true" enables CI mode,
// so `CI=false` (used locally) is correctly treated as non-CI.
const isCI = process.env.CI === '1' || process.env.CI === 'true'

// The production server refuses to boot without AUTH_JWT_SECRET — generate
// a per-run secret when the environment doesn't provide one.
const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? randomBytes(32).toString('hex')

// ABSOLUTE path for the local e2e database. A relative `file:./db/e2e.db`
// URL is resolved by Prisma against prisma/schema.prisma (→ prisma/db/),
// which silently breaks with SQLite "Error 14: Unable to open the database
// file" when that directory doesn't exist. Resolving against the project
// root (Playwright always runs there) puts the DB where you expect it.
const E2E_DB_DIR = path.resolve(process.cwd(), 'db')
const E2E_DB_URL = `file:${path.join(E2E_DB_DIR, 'e2e.db')}`
mkdirSync(E2E_DB_DIR, { recursive: true })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Single worker: the in-memory login rate limiter is shared across requests,
  // so parallel auth tests would interfere with each other.
  workers: 1,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list'], ['html', { open: 'never' }]],
  outputDir: 'tests/.results/artifacts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: undefined },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
  // Start the server automatically (locally: dev server + dedicated e2e DB;
  // CI: production standalone server built by the workflow).
  //
  // E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD flow into the test process env via
  // the shell that launched Playwright (the workflow exports them; locally
  // the deterministic default in auth.setup.ts applies because the local
  // e2e DB is created by these very tests).
  webServer: {
    // Locally: push the schema to the dedicated e2e DB first (CI does this
    // as a separate workflow step), then boot the dev server against it.
    // The DATABASE_URL env var below overrides .env for both commands.
    command: isCI ? 'bun run start' : 'bun run db:push && bun run dev',
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !isCI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // CI exports an absolute DATABASE_URL (see .github/workflows/ci.yml);
      // locally the dedicated absolute e2e DB path computed above is used.
      DATABASE_URL: isCI ? (process.env.DATABASE_URL ?? E2E_DB_URL) : E2E_DB_URL,
      AUTH_JWT_SECRET: JWT_SECRET,
    },
  },
})
