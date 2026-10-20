# Clinic Management System — Setup Guide

A comprehensive clinic management system built with Next.js 16, TypeScript, and Prisma. Manage appointments, billing, inventory, staff, payroll, patients, and reports — all in one place with integer-paise money, argon2id auth, and a full audit trail.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [First-Run Setup](#first-run-setup)
- [Running Locally](#running-locally)
- [Build for Production](#build-for-production)
- [Deployment Options](#deployment-options)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

The Clinic Management System is a single-tenant, HIPAA-style clinic operations platform. It covers appointments (walk-in / website / phone), GST-aware billing with sequence bill numbers, inventory with a complete stock ledger, staff & payroll with a DB-level double-pay guard, patients, suppliers, consultation fees, timezone-aware reports with CSV export, and role-based authentication (Admin / Receptionist). Every sensitive mutation is recorded in an audit log with before/after snapshots.

Key engineering decisions:
- **Money as integer paise** — no Float drift across thousands of bills.
- **Paid bills are immutable** — corrections require an Admin void (with stock restore).
- **argon2id** password hashing + **JWT sessions** with server-side `jti` revocation.
- **Zod** validation on every mutating API route.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime |
| **Bun** | 1.3+ | Recommended package manager & runtime |
| **SQLite** | bundled | Default database (no separate server) |
| **Git** | 2.20+ | Cloning the repository |

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/sudaisalamboy/clinic.git
cd clinic
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` (see [Environment Variables](#environment-variables) below). **`AUTH_JWT_SECRET` is mandatory in production.**

### 4. Initialize the database

```bash
bun run db:generate   # generate Prisma client
bun run db:push       # create / sync the schema (safe — prompts on destructive changes)
```

---

## Environment Variables

```env
DATABASE_URL="file:./db/custom.db"

# JWT signing secret — REQUIRED in production (server refuses to boot without it).
# Generate: openssl rand -hex 32
AUTH_JWT_SECRET="<32+ random chars>"

# Optional JWT claims
AUTH_JWT_ISSUER="clinic"
AUTH_JWT_AUDIENCE="clinic-web"
```

> There is **no** env-based default admin. The first-run setup screen creates the administrator account interactively.

---

## First-Run Setup

On the first launch (empty database), the app shows a **Setup screen**:

1. Open `http://localhost:3000`.
2. Enter your admin email and a strong password (min 12 chars, upper + lower + digit).
3. The password is **argon2id-hashed** — never logged or echoed.
4. The setup endpoint (`POST /api/auth/setup`) only works while the users table is empty and is race-safe (transactional check).
5. Default consultation fees and inventory categories are seeded automatically.
6. The event is recorded in the audit log.

---

## Running Locally

```bash
bun run dev
```

The app is available at **http://localhost:3000**. Dev logs are written to `dev.log`.

Other scripts:

```bash
bun run lint         # ESLint
bun run typecheck    # tsc --noEmit
bun run test:unit    # Vitest unit tests (money math)
bun run test:e2e     # Playwright E2E suite (27 tests)
```

---

## Build for Production

The app uses Next.js **standalone output**:

```bash
bun run build   # builds + copies .next/static and public/ into standalone dir
bun run start   # runs the standalone server
```

Production server: `.next/standalone/server.js` on `PORT` (default `3000`).

> **Before starting in production:** ensure `NODE_ENV=production` and `AUTH_JWT_SECRET` is set, or the server will refuse to boot.

---

## Deployment Options

### Option A — Self-hosted VM / Docker (recommended)

The app uses an **in-memory rate limiter** on the login endpoint. For exact brute-force protection, deploy on a single long-lived instance (VM or container). On serverless platforms with multiple isolated instances, each instance gets its own rate-limit bucket.

```bash
bun install
bun run db:generate
bun run db:push
bun run build
bun run start
```

Run behind the included **Caddyfile** for TLS:

```bash
caddy run --config Caddyfile
```

### Option B — Docker

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run db:generate && bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

Persist `db/` via a volume mount.

### Option C — Vercel / Netlify (with caveats)

The app deploys to serverless, but:
- The in-memory login rate limiter becomes **probabilistic** (per-instance buckets).
- SQLite must be replaced with PostgreSQL (change the provider in `prisma/schema.prisma`).
- For hard brute-force guarantees, front `/api/auth/login` with an edge rate-limiter (Upstash / platform WAF).

### Option D — PostgreSQL (production database)

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then:

```bash
bun run db:generate
bun run db:push
```

---

## Project Structure

```
clinic/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/              # login, logout, setup, status
│   │   │   ├── appointments/      # CRUD + soft-cancel
│   │   │   ├── bills/             # create, mark-paid, void (immutable paid)
│   │   │   ├── consultation-fees/
│   │   │   ├── inventory/         # items, categories, stock movements
│   │   │   ├── patients/
│   │   │   ├── reports/           # timezone-aware analytics + CSV export
│   │   │   ├── salary-payments/  # double-pay guarded payroll
│   │   │   ├── staff/             # soft-delete staff
│   │   │   ├── suppliers/
│   │   │   └── settings/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── error.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── clinic/               # all clinic UI panels
│   │   └── ui/                   # shadcn/ui library
│   └── lib/
│       ├── auth.ts               # argon2id + JWT + revocation list
│       ├── audit.ts              # audit-log helper
│       ├── money.ts              # integer-paise helpers
│       ├── time.ts               # timezone-aware day boundaries
│       ├── api-schemas.ts        # Zod schemas for every mutating route
│       └── db.ts
├── prisma/schema.prisma
├── tests/
│   ├── unit/money.test.ts        # 23 Vitest tests
│   └── e2e/                       # 27 Playwright tests (incl. 316-action workflow)
├── Caddyfile
└── package.json
```

---

## Testing

```bash
bun run test:unit    # Vitest — money math, rounding, discounts, clamping
bun run test:e2e     # Playwright — full workflow, concurrency regression tests
```

The E2E suite includes:
- Login / setup flow & unauthenticated route access (clean 401s)
- Input validation
- Login rate limiting
- Navigation across all 9 modules
- **Financial golden path** — server-authoritative pricing, atomic stock decrement, insufficient-stock rejection, paid-bill immutability, void-with-stock-restore
- **Concurrency regression** — simultaneous voids / pay-discount edits assert exactly one winner

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Server refuses to boot in prod | `AUTH_JWT_SECRET` not set | Set it in `.env`: `AUTH_JWT_SECRET=$(openssl rand -hex 32)` |
| `prisma: command not found` | Prisma CLI not installed | `bun add -d prisma` |
| Setup screen not showing | Database already has a user | The setup endpoint only works on an empty DB; reset with `bun run db:reset` |
| `Database is locked` | Concurrent SQLite writes | Switch to PostgreSQL, or ensure single writer |
| Bill shows wrong total | Float rounding | Money is stored as integer paise; check `src/lib/money.ts` |
| Can't void a paid bill | Paid bills are immutable by design | Only Admins can void (never edit) a paid bill |
| Double salary payment rejected | DB unique constraint `(staffId, month)` | This is intentional — the loser gets a clean 409 |
| Login rate-limited (429) | 5+ attempts/minute | Wait 60 seconds or restart the dev server (in-memory limiter) |
| Stock went negative | Should never happen | Atomic `WHERE quantity >= qty` guard prevents this; check audit log |
| CSV report timezone off | `Settings.timezone` mismatch | Set the correct timezone in Settings (default Asia/Kolkata) |
| `sharp` build error | Native binding | `bun add sharp` or install `libvips-dev` |

---

Made by **Sudais Alam** · [GitHub @sudaisalamboy](https://github.com/sudaisalamboy)
