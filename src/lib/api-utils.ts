/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

/**
 * Shared API utilities for hardened error handling, safe JSON parsing,
 * and consistent request validation across all API routes.
 *
 * Design goals:
 *  - Never leak internal Prisma / DB error messages to the client.
 *  - Map known sentinel error codes thrown by `src/lib/auth.ts` (and our
 *    own validation helper) to appropriate HTTP statuses.
 *  - Always log the real error server-side so debugging still works.
 */

import { NextResponse } from 'next/server'

// ---------- Sentinel error codes ----------

export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
} as const

/**
 * Error subclass carrying a sentinel `code` plus an HTTP-friendly message.
 * Throwing this lets a route signal a specific status without leaking
 * internal stack/Prisma details.
 */
export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** Convenience: throw a 400 Bad Request with a friendly message. */
export function badRequest(message: string): never {
  throw new ApiError(API_ERROR_CODES.BAD_REQUEST, message, 400)
}

/** Convenience: throw a 404 Not Found. */
export function notFound(message = 'Not found'): never {
  throw new ApiError(API_ERROR_CODES.NOT_FOUND, message, 404)
}

/** Convenience: throw a 403 Forbidden with a friendly message. */
export function forbidden(message = 'Forbidden'): never {
  throw new ApiError(API_ERROR_CODES.FORBIDDEN, message, 403)
}

/** Convenience: throw a 409 Conflict (state clash, e.g. already done). */
export function conflict(message = 'Conflict'): never {
  throw new ApiError(API_ERROR_CODES.CONFLICT, message, 409)
}

// ---------- Prisma error introspection ----------

/** Extract a Prisma error code (P2002, P2003, P2025, …) if present. */
export function prismaErrorCode(e: unknown): string | null {
  const direct = (e as { code?: string })?.code
  if (typeof direct === 'string' && direct.startsWith('P')) return direct
  const inner = (e as { error?: { code?: string } })?.error?.code
  if (typeof inner === 'string' && inner.startsWith('P')) return inner
  return null
}

/** For a P2002 (unique constraint) failure, the constraint fields involved. */
export function p2002Targets(e: unknown): string[] {
  const meta = (e as { meta?: { target?: unknown } })?.meta
  const target = (e as { target?: unknown })?.target ?? meta?.target
  if (Array.isArray(target)) return target.map(String)
  if (typeof target === 'string') return [target]
  return []
}

// ---------- Pagination ----------

export const DEFAULT_PAGE_SIZE = 500
export const MAX_PAGE_SIZE = 1000

/**
 * Parse `limit` / `offset` query params into a Prisma `{ skip, take }`.
 * Defaults to 500 rows (single-clinic scale) with a hard cap of 1000 so a
 * runaway table can never produce unbounded response payloads.
 */
export function parsePagination(url: URL): { skip: number; take: number } {
  const limit = Number(url.searchParams.get('limit'))
  const offset = Number(url.searchParams.get('offset'))
  const take =
    Number.isFinite(limit) && limit > 0
      ? Math.min(Math.floor(limit), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE
  const skip = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0
  return { skip, take }
}

/** JSON list response carrying the total row count in `X-Total-Count`. */
export function listResponse<T>(items: T[], total: number): NextResponse {
  return NextResponse.json(items, {
    headers: { 'X-Total-Count': String(total) },
  })
}

// ---------- Safe JSON parsing ----------

/**
 * Safely parse an incoming JSON body. Never throws — returns `{ data }` on
 * success or `{ error }` if the body is missing / malformed.
 */
export async function safeJson(req: Request): Promise<
  | { data: unknown; error: null }
  | { data: null; error: string }
> {
  try {
    const text = await req.text()
    if (!text) return { data: null, error: 'Request body is empty' }
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object') {
      return { data: null, error: 'Request body must be a JSON object' }
    }
    return { data: parsed, error: null }
  } catch {
    return { data: null, error: 'Invalid JSON body' }
  }
}

// ---------- Caller IP extraction (for audit context) ----------

/**
 * Best-effort extraction of the caller IP for audit logging. Honours the
 * standard `x-forwarded-for` (first hop) and `x-real-ip` headers. Returns
 * null if neither is present (e.g. same-origin server-to-server calls).
 *
 * NOTE: This is for AUDIT ONLY — never use it for security decisions like
 * rate limiting or auth (those headers are trivially spoofable from
 * untrusted clients; the global rate-limit bucket in auth/login/route.ts
 * intentionally ignores per-IP inputs).
 */
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? null
  return req.headers.get('x-real-ip') ?? null
}

// ---------- Response helpers ----------

/** Build a JSON error response with a given status and message. */
export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

// ---------- Centralized error mapping ----------

/**
 * Map any thrown error to a safe HTTP response. Internal/Prisma messages are
 * NEVER returned to the client — only friendly, well-known strings are.
 *
 * Mapping:
 *   - ApiError            -> uses its own status + message
 *   - 'UNAUTHORIZED'      -> 401 "Authentication required"
 *   - 'FORBIDDEN'         -> 403 "Forbidden"
 *   - 'BAD_REQUEST'      -> 400 (keeps message)
 *   - 'VALIDATION'       -> 400 (keeps message)
 *   - 'NOT_FOUND'        -> 404 (keeps message)
 *   - Prisma P2002 (unique constraint) -> 409 "Resource already exists"
 *   - Prisma P2003 (FK violation)      -> 400 "Referenced record not found"
 *   - Prisma P2025 (record not found)  -> 404 "Resource not found"
 *   - everything else    -> 500 "Internal server error"
 */
export function handleApiError(e: unknown): NextResponse {
  // Always log the real error server-side for debugging.
  console.error('[api] error:', e)

  if (e instanceof ApiError) {
    return apiError(e.status, e.message)
  }

  const code = (e as Error)?.message
  switch (code) {
    case API_ERROR_CODES.UNAUTHORIZED:
      return apiError(401, 'Authentication required')
    case API_ERROR_CODES.FORBIDDEN:
      return apiError(403, 'Forbidden')
    case API_ERROR_CODES.CONFLICT:
      return apiError(409, 'Conflict')
    case API_ERROR_CODES.NOT_FOUND:
      return apiError(404, 'Not found')
    case API_ERROR_CODES.BAD_REQUEST:
    case API_ERROR_CODES.VALIDATION:
      // Validation messages are user-supplied / safe to surface.
      return apiError(400, (e as Error).message || 'Bad request')
    default: {
      // Detect Prisma-specific codes when available.
      const prismaCode = prismaErrorCode(e)
      if (prismaCode === 'P2002') {
        return apiError(409, 'Resource already exists')
      }
      if (prismaCode === 'P2003') {
        // FK violation — e.g. an appointment referencing a non-existent
        // doctor/patient/fee. Friendly message instead of a raw 500.
        return apiError(
          400,
          'A referenced record does not exist (e.g. doctor, patient, category, or fee). Please refresh and try again.',
        )
      }
      if (prismaCode === 'P2025') {
        return apiError(404, 'Resource not found')
      }
      // Last resort — never leak the real message.
      return apiError(500, 'Internal server error')
    }
  }
}
