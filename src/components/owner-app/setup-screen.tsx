'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, KeyRound, User, Loader2, Lock, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  onDone: () => void
}

function passwordStrength(p: string): { score: number; label: string } {
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 10) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  return { score, label: labels[score] }
}

export function SetupScreen({ onDone }: Props) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [autoLock, setAutoLock] = useState(15)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = passwordStrength(password)
  const mismatch = confirm.length > 0 && password !== confirm

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Please enter your name.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          password,
          passwordHint: hint.trim() || undefined,
          autoLockMinutes: autoLock,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Setup failed')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-4">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Claim your vault</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            This app is private. Set up your owner credentials to lock it down. No one else will be able to access it.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Owner name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                className="pl-9"
                autoComplete="name"
                disabled={busy}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pl-9 pr-10"
                autoComplete="new-password"
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
            {password && (
              <div className="space-y-1.5">
                <Progress value={(strength.score / 5) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  Strength: <span className="text-foreground/80 font-medium">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm"
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="pl-9"
                autoComplete="new-password"
                disabled={busy}
              />
            </div>
            {mismatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hint">Password hint (optional)</Label>
            <Textarea
              id="hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="A reminder only you would understand"
              rows={2}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">Shown on the lock screen if you forget.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autolock" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Auto-lock after
            </Label>
            <div className="flex gap-2 flex-wrap">
              {[5, 15, 30, 60].map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={autoLock === m ? 'default' : 'outline'}
                  onClick={() => setAutoLock(m)}
                  disabled={busy}
                >
                  {m}m
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              The app will lock itself automatically after this many minutes of inactivity.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy || mismatch}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Lock it down
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
          Your password is hashed with scrypt and stored locally. There is no recovery — if you forget it, the vault is sealed.
        </p>
      </motion.div>
    </div>
  )
}
