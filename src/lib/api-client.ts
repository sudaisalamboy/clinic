/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

'use client'

/**
 * Client-side fetch wrapper for all clinic API calls.
 *
 * Why this exists (it fixes a whole class of bugs, not just style):
 *
 * 1. Raw `fetch()` + `res.json()` NEVER rejects on HTTP error status — a
 *    401/500 body (`{ error: "..." }`) flows straight into list state and
 *    the panel crashes with `items.map is not a function`. Every call site
 *    had to remember to check `res.ok`; most forgot. Now it is structural.
 *
 * 2. Session expiry (24h JWT) previously produced that exact crash →
 *    white screen. On 401 we hard-navigate: `window.location.reload()`
 *    re-runs the `/api/auth/status` check in page.tsx, which renders the
 *    login screen. (A reload — not a pushState — guarantees all stale
 *    in-memory state is discarded.)
 *
 * 3. Error messages come from the API's own `{ error }` envelope, so users
 *    see actionable messages ("Insufficient stock…") instead of generics.
 *
 * NOT used by the login/setup screens: there a 401 means "wrong
 * credentials", not "expired session", and those screens already surface
 * it as a friendly toast.
 */

/** Error thrown by apiFetch for any non-2xx response. */
export class ApiClientError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

/** Set once a 401 has triggered a reload — prevents reload loops. */
let handling401 = false

function throwApiError(status: number, body: unknown): never {
  let message = `Request failed (${status})`
  if (
    body &&
    typeof body === 'object' &&
    typeof (body as { error?: unknown }).error === 'string'
  ) {
    message = (body as { error: string }).error
  }
  throw new ApiClientError(message, status)
}

/**
 * Fetch JSON from the clinic API.
 *
 * - Resolves with the parsed body on 2xx.
 * - Rejects with ApiClientError (message from the server) on other status.
 * - On 401: reloads the page (see module docs) and rejects.
 */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)

  if (res.status === 401) {
    if (!handling401 && typeof window !== 'undefined') {
      handling401 = true
      window.location.reload()
    }
    throw new ApiClientError('Your session has expired — signing you in again.', 401)
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) throwApiError(res.status, body)
  return body as T
}

/**
 * Fetch a paginated list endpoint (one that responds with a JSON array and
 * the total row count in the `X-Total-Count` header — see
 * `listResponse()` in src/lib/api-utils.ts).
 *
 * Returns the page data AND the total, so the UI can tell the user when
 * the list is truncated (default server page size is 500): without that
 * notice, record #501 is silently invisible.
 */
export async function apiFetchList<T>(
  url: string,
  init?: RequestInit,
): Promise<{ data: T[]; total: number }> {
  const res = await fetch(url, init)

  if (res.status === 401) {
    if (!handling401 && typeof window !== 'undefined') {
      handling401 = true
      window.location.reload()
    }
    throw new ApiClientError('Your session has expired — signing you in again.', 401)
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) throwApiError(res.status, body)

  const data = Array.isArray(body) ? (body as T[]) : []
  const headerTotal = Number(res.headers.get('X-Total-Count'))
  const total = Number.isFinite(headerTotal) && headerTotal > 0 ? headerTotal : data.length
  return { data, total }
}
