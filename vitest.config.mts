/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Unit-test configuration (Vitest).
 *
 * Scope: pure functions only (money math, formatters) — no DB, no network,
 * no React rendering. E2E browser coverage lives in Playwright
 * (playwright.config.ts). Keeping the two runners separate means unit
 * tests stay millisecond-fast and run on every push in CI.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
