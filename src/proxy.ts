/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import { NextResponse } from 'next/server'

/**
 * Edge proxy — runs on every matched request BEFORE the route handler.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`; the export
 * must be named `proxy` and the file must be `src/proxy.ts`. (The old
 * `middleware` name still works but emits a deprecation warning.)
 *
 * `next.config.ts -> headers()` can only ADD response headers; it cannot
 * DELETE headers that an upstream layer may have already injected. This
 * proxy is the only place we can strip those defensively, so the client
 * never sees host-platform internals.
 *
 * CORS lockdown (Access-Control-Allow-Origin / -Credentials) is configured
 * globally in `next.config.ts`, so it is NOT repeated here.
 */
const STRIP_RESPONSE_HEADERS = [
  'x-fc-request-id',
  'x-fc-error-type',
  'x-fc-code-checksum',
  'x-fc-invocation-duration',
  'x-fc-max-memory-usage',
  'x-fc-log-result',
  'x-fc-invocation-code-version',
  'x-fc-instance-id',
  'x-session-id',
  'access-control-expose-headers',
]

export function proxy() {
  const res = NextResponse.next()
  for (const h of STRIP_RESPONSE_HEADERS) {
    res.headers.delete(h)
  }
  return res
}

export const config = {
  matcher: '/api/:path*',
}
