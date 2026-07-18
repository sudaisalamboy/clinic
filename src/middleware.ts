import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Strip platform-injected metadata headers from all API responses
const STRIP_HEADERS = [
  'abc',
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

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Strip platform headers from the response
  for (const h of STRIP_HEADERS) {
    res.headers.delete(h)
  }

  // Ensure CORS is locked down
  res.headers.set('Access-Control-Allow-Origin', '')
  res.headers.set('Access-Control-Allow-Credentials', 'false')

  return res
}

export const config = {
  matcher: '/api/:path*',
}
