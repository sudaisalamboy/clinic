'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldAlert,
  Lightbulb,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  ownerName?: string
  initialLockMs?: number
  hint?: string | null
  onUnlocked: () => void
}

function fmt(ms: number): string {
  if (ms <= 0) return '0:00'
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LockScreen({
  ownerName,
  initialLockMs = 0,
  hint,
  onUnlocked,
}: Props) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockMs, setLockMs] = useState(initialLockMs)
  const inputRef = useRef<HTMLInputElement>(null)

  // Lockout countdown
  useEffect(() => {
    if (lockMs <= 0) return
    const id = setInterval(() => {
      setLockMs((v) => {
        const next = Math.max(0, v - 1000)
        if (next === 0) {
          setError(null)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [lockMs])

  useEffect(() => {
    if (lockMs <= 0) inputRef.current?.focus()
  }, [lockMs])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (lockMs > 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.locked && data.remainingMs) {
          setLockMs(data.remainingMs)
        }
        throw new Error(data.error ?? 'Login failed')
      }
      setPassword('')
      onUnlocked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const locked = lockMs > 0

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4 ring-1 ${
              locked
                ? 'bg-destructive/10 ring-destructive/20'
                : 'bg-primary/10 ring-primary/20'
            }`}
          >
            {locked ? (
              <ShieldAlert className="h-8 w-8 text-destructive" />
            ) : (
              <Lock className="h-8 w-8 text-primary" />
            )}
          </motion.div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {locked ? 'Temporarily locked' : 'Locked'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ownerName ? (
              <>Welcome back, <span className="text-foreground font-medium">{ownerName}</span>.</>
            ) : (
              <>Enter your password to continue.</>
            )}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border bg-card p-6 shadow-sm space-y-5"
        >
          {locked ? (
            <div className="text-center space-y-3 py-4">
              <div className="inline-flex items-center gap-2 text-destructive">
                <Clock className="h-5 w-5" />
                <span className="text-3xl font-mono font-semibold tabular-nums">
                  {fmt(lockMs)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Too many failed attempts. Try again after the timer ends.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    id="password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    tabIndex={-1}
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {hint && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border rounded-md p-2.5">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span><span className="font-medium text-foreground/80">Hint:</span> {hint}</span>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2"
                >
                  {error}
                </motion.div>
              )}

              <Button type="submit" className="w-full" disabled={busy || !password}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Unlock
              </Button>
            </>
          )}
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Single-user vault. No sign-up. No multi-user. Only the owner can enter.
        </p>
      </motion.div>
    </div>
  )
}
