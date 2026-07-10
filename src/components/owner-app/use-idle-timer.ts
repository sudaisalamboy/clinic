'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

/**
 * Tracks user activity (mousemove, keypress, click, scroll, touch) and calls
 * onIdle() when no activity has happened for `timeoutMs` milliseconds.
 * Also exposes the time remaining until idle.
 */
export function useIdleTimer(timeoutMs: number, onIdle: () => void) {
  const [remainingMs, setRemainingMs] = useState(timeoutMs)
  const lastActivityRef = useRef<number>(Date.now())
  const timeoutRef = useRef<number>(timeoutMs)
  const onIdleRef = useRef(onIdle)

  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  useEffect(() => {
    timeoutRef.current = timeoutMs
    lastActivityRef.current = Date.now()
    setRemainingMs(timeoutMs)
  }, [timeoutMs])

  useEffect(() => {
    let raf: number
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    const onActivity = () => {
      lastActivityRef.current = Date.now()
    }
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    const tick = () => {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = Math.max(0, timeoutRef.current - elapsed)
      setRemainingMs(remaining)
      if (remaining <= 0) {
        onIdleRef.current()
        // Stop ticking until reset by re-mount
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      events.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [])

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now()
    setRemainingMs(timeoutRef.current)
  }, [])

  return { remainingMs, reset }
}
