'use client'

import { useEffect, useState } from 'react'
import {
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  User,
  Lightbulb,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface Props {
  owner: { id: string; name: string; autoLockMinutes: number; passwordHint?: string | null; createdAt?: string | Date }
  onAutoLockChange: (m: number) => void
  onLock: () => void
}

export function SettingsPanel({ owner, onAutoLockChange, onLock }: Props) {
  // Profile
  const [name, setName] = useState(owner.name)
  const [hint, setHint] = useState(owner.passwordHint ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Auto-lock
  const [autoLock, setAutoLock] = useState(owner.autoLockMinutes)
  const [savingAutoLock, setSavingAutoLock] = useState(false)

  // Change password
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    setName(owner.name)
    setHint(owner.passwordHint ?? '')
    setAutoLock(owner.autoLockMinutes)
  }, [owner])

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), passwordHint: hint.trim() || null }),
      })
      if (!res.ok) throw new Error('save failed')
      toast({ title: 'Profile updated' })
    } catch {
      toast({ title: 'Failed to update profile', variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveAutoLock() {
    setSavingAutoLock(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoLockMinutes: autoLock }),
      })
      if (!res.ok) throw new Error('save failed')
      onAutoLockChange(autoLock)
      toast({ title: `Auto-lock set to ${autoLock} minutes` })
    } catch {
      toast({ title: 'Failed to update auto-lock', variant: 'destructive' })
    } finally {
      setSavingAutoLock(false)
    }
  }

  async function changePassword() {
    if (next !== confirm) return toast({ title: 'Passwords do not match', variant: 'destructive' })
    if (next.length < 6) return toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
    setSavingPwd(true)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'change failed')
      setCur(''); setNext(''); setConfirm('')
      toast({ title: 'Password changed', description: 'All other sessions were signed out.' })
    } catch (e) {
      toast({
        title: 'Failed to change password',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSavingPwd(false)
    }
  }

  async function revokeSessions() {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (!res.ok) throw new Error('revoke failed')
      toast({ title: 'Signed out everywhere else' })
    } catch {
      toast({ title: 'Failed to revoke sessions', variant: 'destructive' })
    }
  }

  const pwdMismatch = confirm.length > 0 && next !== confirm
  const pwdSame = cur.length > 0 && next === cur

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Owner profile
          </CardTitle>
          <CardDescription>How the app addresses you on the lock screen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Display name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-hint" className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
              Password hint
            </Label>
            <Textarea id="s-hint" value={hint} onChange={(e) => setHint(e.target.value)} rows={2} placeholder="Shown on the lock screen" />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile || !name.trim() || name === owner.name && hint === (owner.passwordHint ?? '')}>
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Save profile
          </Button>
        </CardContent>
      </Card>

      {/* Auto-lock */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Auto-lock
          </CardTitle>
          <CardDescription>The app will lock itself after this many minutes of inactivity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[1, 5, 15, 30, 60, 120].map((m) => (
              <Button
                key={m}
                size="sm"
                variant={autoLock === m ? 'default' : 'outline'}
                onClick={() => setAutoLock(m)}
              >
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Current: <span className="text-foreground font-medium">{autoLock} minute{autoLock === 1 ? '' : 's'}</span>
          </p>
          <Button onClick={saveAutoLock} disabled={savingAutoLock || autoLock === owner.autoLockMinutes}>
            {savingAutoLock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            Update auto-lock
          </Button>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Change password
          </CardTitle>
          <CardDescription>Rotate your vault password. All other sessions will be signed out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cur">Current password</Label>
            <div className="relative">
              <Input
                id="cur"
                type={showPwd ? 'text' : 'password'}
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">New password</Label>
            <Input id="next" type={showPwd ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conf">Confirm new password</Label>
            <Input id="conf" type={showPwd ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {pwdMismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
          {pwdSame && <p className="text-xs text-destructive">New password must be different.</p>}
          <Button onClick={changePassword} disabled={savingPwd || !cur || !next || pwdMismatch || pwdSame}>
            {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Change password
          </Button>
        </CardContent>
      </Card>

      {/* Sessions / danger zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Sessions
          </CardTitle>
          <CardDescription>Manage your active sessions across devices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-sm bg-muted/30">
            <p className="font-medium">Sign out everywhere else</p>
            <p className="text-xs text-muted-foreground mt-1">
              This will sign out every other device. Your current browser will stay signed in.
            </p>
          </div>
          <Button variant="outline" onClick={revokeSessions} className="w-full">
            <Smartphone className="h-4 w-4" />
            Revoke other sessions
          </Button>

          <Separator className="my-2" />

          <div className="rounded-md border border-destructive/30 p-3 text-sm bg-destructive/5">
            <p className="font-medium text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Lock now
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Immediately lock the app. You will need to re-enter your password.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Clock className="h-4 w-4" />
                Lock the vault now
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lock the vault now?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will be returned to the lock screen and asked for your password to come back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onLock}>Lock now</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
