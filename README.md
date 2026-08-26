# 🏥 Clinic Management System

A comprehensive clinic management system built with Next.js, TypeScript, and Prisma. Manage appointments, billing, inventory, staff, payroll, patients, and reports — all in one place.

## ✨ Features

- **Dashboard** — KPI cards, revenue charts, appointment status, low-stock alerts (timezone-aware)
- **Appointments** — Walk-in / Website / Phone booking with status tracking and soft-cancel
- **Billing** — sequence-generated bill numbers, GST, discounts, server-authoritative pricing, immutable paid bills, void-with-stock-restore
- **Inventory** — Stock management with categories, suppliers, expiry tracking, and a complete stock ledger (in / out / adjust / return)
- **Staff** — Doctor/Nurse/Receptionist management with **soft-delete** (audit-safe)
- **Payroll** — monthly salary payments per staff member (Cash / UPI / Bank Transfer) with a **DB-level double-pay guard** (unique `staffId + month`), per-staff payment history & totals, and full audit trail
- **Patients** — Patient registry with visit/bill history (denormalised names kept for backward compat)
- **Suppliers** — Vendor management with contact details
- **Consultation Fees** — Configurable fee types (General OPD, Follow Up, Emergency)
- **Reports** — Daily/weekly/monthly analytics with CSV export and print, computed in the clinic's timezone
- **Settings** — Clinic profile, theme colors, currency, timezone configuration
- **Authentication** — Role-based login (Admin/Receptionist), **argon2id** password hashing, **jose JWT** sessions with **server-side revocation** (logout kills stolen tokens)
- **Audit log** — HIPAA-style audit trail of **every** sensitive mutation: settings, staff, patients, suppliers, consultation fees, inventory items/categories, stock movements, bills (create/update/void), appointments, salary payments, login/logout, and first-run setup

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5 (strict)
- **Styling:** Tailwind CSS 4 (CSS-based config) + shadcn/ui
- **Database:** Prisma ORM (SQLite) — money stored as **integer paise**, never Float
- **Validation:** Zod on every mutating API route
- **Auth:** `@node-rs/argon2` (password hashing) + `jose` (JWT session signing, jti revocation list)
- **Charts:** Recharts
- **Animations:** Framer Motion
- **Icons:** Lucide React

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm / bun / yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sudaisalamboy/clinic-management-system.git

# Navigate to project directory
cd clinic-management-system

# Install dependencies
bun install

# Set up the database (safe — prompts on destructive changes)
bun run db:push

# Start the development server
bun run dev
```

### Required environment variables

Copy `.env.example` to `.env` and fill in real values. **`AUTH_JWT_SECRET` is mandatory in production** — the app refuses to boot without it in `NODE_ENV=production`.

```bash
DATABASE_URL="file:./db/custom.db"
AUTH_JWT_SECRET="<32+ random chars — generate with: openssl rand -hex 32>"
AUTH_JWT_ISSUER="clinic"
AUTH_JWT_AUDIENCE="clinic-web"
```

### First-run setup (no default credentials)

There is **no** env-based default admin and no guessable seed account. On the
first launch (empty database) the app shows a **Setup screen** where you create
the administrator account yourself:

- pick your own email and a strong password (min 12 chars, upper + lower + digit)
- the password is argon2id-hashed — it is never logged or echoed anywhere
- the setup endpoint (`POST /api/auth/setup`) only works while the users table
  is empty and is race-safe (transactional check), so it can never inject an
  account into a live system
- the event is recorded in the audit log

The same screen seeds default consultation fees and inventory categories.

## 📁 Project Structure

```
src/
├── app/
│   ├── api/              # API routes (auth, staff, patients, inventory, bills,
│   │                     #   salary-payments, consultation fees, settings, reports)
│   ├── globals.css       # Tailwind 4 theme + global styles
│   ├── layout.tsx        # Root layout
│   ├── error.tsx         # Route-level error boundary
│   └── page.tsx          # Main entry (setup / auth router)
├── components/
│   ├── clinic/           # All clinic UI components
│   │   ├── app-shell.tsx
│   │   ├── dashboard-panel.tsx
│   │   ├── inventory-panel.tsx
│   │   ├── appointments-panel.tsx
│   │   ├── billing-panel.tsx
│   │   ├── consultation-fees-panel.tsx
│   │   ├── staff-panel.tsx
│   │   ├── suppliers-panel.tsx
│   │   ├── reports-panel.tsx
│   │   ├── settings-panel.tsx
│   │   ├── login-screen.tsx
│   │   ├── setup-screen.tsx
│   │   ├── list-truncated-notice.tsx
│   │   ├── empty-state.tsx
│   │   ├── skeletons.tsx
│   │   └── date-picker.tsx
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── auth.ts           # argon2id hashing + JWT sessions + revocation list
│   ├── audit.ts          # Audit-log helper
│   ├── money.ts          # Integer-paise money helpers + entity serializers
│   ├── time.ts           # Timezone-aware day-boundary helpers (Intl)
│   ├── api-schemas.ts    # Zod schemas for every mutating API route
│   ├── api-utils.ts      # Shared API helpers (errors, pagination, Prisma mapping)
│   ├── api-client.ts     # Frontend fetch wrapper (401 → session-expiry reload)
│   ├── seed.ts           # Default data seeding (used by first-run setup)
│   ├── db.ts             # Prisma client (dev-only query logging)
│   └── settings.ts       # Settings singleton helper
├── proxy.ts             # Strips platform response headers on /api/*
└── prisma/
    └── schema.prisma      # Database schema
```

## 🔒 Security Features

### Financial integrity

- **Integer money** — every monetary value is stored as integer paise (₹1 = 100) and every percentage as basis points; the API converts at the boundary. No Float drift across thousands of bills.
- **Server-authoritative billing prices** — line-item prices for inventory items come from the item's `sellingPrice`; client-supplied prices are ignored. Custom line items are capped.
- **Atomic stock control** — billing and stock-out use guarded atomic updates (`WHERE quantity >= qty`), so concurrent requests can never oversell or drive stock negative.
- **Paid bills are immutable** — once a bill is settled it cannot be edited (a classic cash-siphon vector). Corrections require an Admin to **void** the bill.
- **Void, never delete** — voiding a bill restores the billed stock (each restore is a `return` stock-transaction row) and keeps the financial record forever; revenue reports exclude voided bills.
- **Stock ledger** — stock levels change *only* through `/api/inventory/stock`; the item PUT endpoint rejects quantity edits, so every movement is auditable.
- **Sequence bill numbers** — a per-year `BillSequence` row incremented inside the create transaction; no string-ordering collisions after 9999 bills/year.
- **Payroll double-pay guard** — a unique constraint on `(staffId, month)` makes it impossible to pay the same staff member twice for the same month, even under concurrent requests (the loser gets a clean 409). Payments to deactivated staff are rejected, and every payment/deletion is audited.

### Authentication & authorization

- **argon2id** password hashing (OWASP-recommended parameters)
- JWT sessions (HS256, 24h, HttpOnly cookie) with a unique `jti`; **logout records the jti in a revocation table**, so a stolen token dies with the session
- Secret **required in production** (fail-fast at boot)
- Rate limiting on login (5 attempts/minute) — see deployment note below
- Consistent role matrix:

| Action | Admin | Receptionist |
|---|---|---|
| Appointments, patients, bills (create/mark-paid), stock movements | ✅ | ✅ |
| Edit unpaid bill (discount/GST/notes) | ✅ | ✅ |
| Void bill · edit/delete inventory items & categories · staff · suppliers · consultation fees · settings · **salary payments** | ✅ | ❌ |
| Edit paid/voided bill | ❌ (immutable) | ❌ |

### Audit & privacy

- **Audit log of every sensitive mutation** (see list above) with before/after snapshots and caller IP
- Zod input validation on every mutating route (NoSQL / object-injection prevention)
- Security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS preload, strict CSP (`unsafe-eval` and `ws:` are dev-only)
- CORS: the app is same-origin — no `Access-Control-Allow-*` headers are emitted at all
- No internal error leakage — API errors return generic messages (Prisma P2002/P2003/P2025 mapped to friendly 409/400/404)
- All API routes require authentication **except** `/api/auth/login`, `/api/auth/status`, and `/api/auth/setup` (the latter only works on an empty DB)

### Deployment note: rate limiting on serverless

The login rate limiter uses in-memory state. On a single long-lived server (the documented deployment model) it is exact. On serverless platforms that spin up multiple isolated instances, each instance gets its own bucket — brute-force protection becomes probabilistic. For serverless deployments, front `/api/auth/login` with an edge rate-limiter (platform WAF / Upstash) for hard guarantees.

## 📝 Data-model notes

- **Single-tenant by design.** `Settings` is a singleton; there is no `clinicId` foreign key. Multi-tenant would require forking the schema.
- **Enums as strings.** Status/role/payment fields are `String` (validated by Zod enums on write) rather than Prisma `enum`, because SQLite does not support native enums. Type safety is enforced at the API boundary.
- **Money as integer paise.** See `src/lib/money.ts`. SQLite has no native DECIMAL type and Float drifts; minor units are exact.
- **Soft deletes where history matters.** Staff, inventory items, and appointments deactivate/cancel instead of deleting; bills void. Only truly history-less rows (suppliers, unreferenced fees/patients) hard-delete, always guarded + audited.
- **Timezone-aware reporting.** "Today" and day boundaries come from `Settings.timezone` (default Asia/Kolkata), computed via `Intl` — not from the server clock.

## 🧪 Tests

```bash
# Lint (eslint) + type-check (tsc --noEmit)
bun run lint
bun run typecheck

# Unit tests (23) — the money math (calcBillTotals, paise/bps converters):
# rounding at half-paise, discount/GST shapes, clamping, boundary caps.
bun run test:unit

# E2E suite (27 tests incl. a 316-action full workflow)
bun run test:e2e
```

The Playwright suite covers: the login/setup flow, unauthenticated access to
every protected route (asserting clean, leak-free 401s), input validation,
login rate limiting, navigation across all panels, and a full **financial
golden path** — server-authoritative pricing, atomic stock decrement,
insufficient-stock rejection, paid-bill immutability, void-with-stock-restore,
and correct in/out/adjust/return stock semantics. Two **concurrency
regression tests** fire simultaneous voids and simultaneous pay/discount
edits against the same bill and assert exactly one winner / no torn state.

### The 300+ action full workflow (`tests/e2e/full-workflow.spec.ts`)

A single suite drives the **real UI end-to-end, 300+ discrete actions per run
(316 at the time of writing)** — a true backend↔frontend integration test:

- fresh UI login (logout → credential entry → dashboard) and a navigation sweep across **all 9 modules**
- settings CRUD with persistence checks
- **staff**: add 5 members (doctors / nurse / receptionist), salary raise via edit, ban 2 of them (soft-delete → Inactive), search, profile view
- **payroll**: salary payments across staff and months (UPI / Bank Transfer), double-pay 409 toast, entry deletion, banned-staff pay rejection
- **suppliers**: add / edit / delete
- **inventory**: category, 4 items, stock in / out / return / adjust with **exact quantity assertions**, price edit, deactivate, search
- **consultation fees**: add / edit / delete
- **patients & appointments**: 25 bulk patients + 3 UI appointments (book / complete / no-show / cancel)
- **billing**: bills with medicine lines, **atomic stock deduction** (130 → 128), mark-paid, receipt view, void + **stock restore** (128 → 130)
- backend integrity round-trips (staff / salary / patient / report APIs, 409 / 400 / 401 guards)

Every action is counted; the final test asserts **≥ 300 executed**. The suite
is re-runnable against an existing database (unique run-id suffix per
invocation) — it has been verified three times consecutively against the same DB.

## 🔁 CI Pipeline

`.github/workflows/ci.yml` runs on every push/PR to `main`:

1. **Lint, Type-check & Unit Tests** — eslint, `tsc --noEmit` (lint alone doesn't type-check), 23 Vitest unit tests
2. **Playwright E2E (incl. the 300+ action full workflow)** — builds the production server, generates **per-run random admin credentials** (nothing committed), runs the full 27-test suite (incl. the 316-action workflow) against it, uploads the HTML report + traces on failure
3. **Production Build** — standalone build + boot smoke test (HTTP 200)

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Sudais Alam**

- GitHub: [@sudaisalamboy](https://github.com/sudaisalamboy)

---

Made with ❤️ by Sudais Alam
