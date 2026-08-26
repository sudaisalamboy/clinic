/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { seedDefaultData } from '@/lib/seed'
import {
  handleApiError,
  safeJson,
  badRequest,
  conflict,
  getClientIp,
  prismaErrorCode,
  p2002Targets,
} from '@/lib/api-utils'
import { writeAudit } from '@/lib/audit'
import { setupSchema } from '@/lib/api-schemas'

/**
 * First-run setup: creates the initial Admin account.
 *
 * Security properties:
 *  - Only works while the users table is EMPTY (409 afterwards), so it can
 *    never be used to inject an account into a live system.
 *  - The empty-check + insert run inside one interactive transaction. On
 *    SQLite (Prisma uses BEGIN IMMEDIATE) writers are serialized, so two
 *    concurrent setup calls cannot both observe an empty table.
 *  - The password is argon2id-hashed (never logged, never echoed back).
 *  - The event is written to the audit log — a critical security event.
 *  - No default/guessable credentials exist anywhere: the operator chooses
 *    the email and a strong password at setup time.
 */
export async function POST(req: Request) {
  try {
    const { data, error } = await safeJson(req)
    if (error) badRequest(error)
    const parsed = setupSchema.safeParse(data)
    if (!parsed.success) badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    // CPU-heavy hashing happens BEFORE the transaction so the write lock
    // is held for the shortest possible time.
    const passwordHash = await hashPassword(d.password)

    const user = await db.$transaction(async (tx) => {
      const count = await tx.user.count()
      if (count > 0) {
        // 409 Conflict — the documented, test-asserted status for
        // "setup already completed" (matches auth.setup.ts in the e2e
        // suite). 403 would wrongly imply a permission problem.
        conflict('Setup has already been completed. Please sign in.')
      }
      const created = await tx.user.create({
        data: {
          name: d.name,
          email: d.email,
          passwordHash,
          role: 'Admin',
        },
      })
      await seedDefaultData(tx)
      return created
    })

    // Critical security event — audit it. No password material is stored.
    await writeAudit({ userId: user.id, ip: getClientIp(req) }, 'auth.setup', {
      entity: 'User',
      entityId: user.id,
      after: { email: user.email, name: user.name, role: user.role },
    })

    // Log the new admin straight in — the setup screen flows into the app.
    await createSession({ id: user.id, name: user.name, role: user.role })

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (e) {
    // A duplicate-email race on a still-empty DB maps to a friendly 409.
    if (prismaErrorCode(e) === 'P2002' && p2002Targets(e).includes('email')) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      )
    }
    return handleApiError(e)
  }
}
