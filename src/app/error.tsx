/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

'use client'

import { useEffect } from 'react'
import { AlertTriangle, LogIn, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Route-level error boundary (Next.js App Router file convention).
 *
 * Before this existed, ANY uncaught client-side exception (e.g. a fetch
 * that returned an error payload into list state and then called
 * `.map` on it) produced a white screen with no recovery. Now the user
 * gets a calm message and two ways out: retry the failed render, or
 * bounce to the root (which re-runs the auth status check and shows the
 * login screen if the session died).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface it for diagnostics — the user never sees a raw stack.
    console.error('[ui] unhandled error:', error)
  }, [error])

  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center bg-background p-6"
    >
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error interrupted the clinic panel. Your data is safe — try
            again, and if the problem keeps happening, sign in again.
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in again
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
