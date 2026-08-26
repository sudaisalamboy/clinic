/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

/**
 * Audit-log helper.
 *
 * The audit trail is a HIPAA-style record of who did what to which row.
 * Because SQLite has no native JSON column, `before` / `after` snapshots
 * are JSON-stringified before being persisted.
 *
 * CRITICAL: `writeAudit` MUST NEVER throw into the request path. If
 * audit persistence fails for any reason, we catch and log server-side
 * so the user's primary action (e.g. login, settings update, soft
 * delete) still completes successfully. Audit is observability, not a
 * gate.
 */
import { db } from './db'

export interface AuditContext {
  userId: string | null
  ip?: string | null
}

/**
 * Write an audit-log entry. NEVER throws into the request path — all
 * failures are caught and logged server-side so the user's action still
 * completes even if audit persistence breaks.
 */
export async function writeAudit(
  ctx: AuditContext,
  action: string,
  opts: { entity?: string; entityId?: string; before?: unknown; after?: unknown } = {},
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        before: opts.before !== undefined ? JSON.stringify(opts.before) : null,
        after: opts.after !== undefined ? JSON.stringify(opts.after) : null,
        ip: ctx.ip ?? null,
      },
    })
  } catch (e) {
    console.error('[audit] failed to write log:', e)
  }
}
