'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, ShieldCheck } from 'lucide-react'
import { SetupScreen } from '@/components/owner-app/setup-screen'
import { LockScreen } from '@/components/owner-app/lock-screen'
import { Dashboard } from '@/components/owner-app/dashboard'

type Phase = 'loading' | 'setup' | 'locked' | 'unlocked'

interface Status {
  ownerExists: boolean
  authenticated: boolean
  owner: { id?: string; name: string; autoLockMinutes?: number; passwordHint?: string | null; createdAt?: string | Date } | null
  lock: { locked: boolean; remainingMs: number }
}

interface OwnerInfo {
  id: string
  name: string
  autoLockMinutes: number
  passwordHint?: string | null
  createdAt?: string | Date
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<Status | null>(null)
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('status failed')
      const data: Status = await res.json()
      setStatus(data)
      if (!data.ownerExists) {
        setPhase('setup')
      } else if (data.authenticated && data.owner && data.owner.id) {
        setOwnerInfo({
          id: data.owner.id,
          name: data.owner.name,
          autoLockMinutes: data.owner.autoLockMinutes ?? 15,
          passwordHint: data.owner.passwordHint,
          createdAt: data.owner.createdAt,
        })
        setPhase('unlocked')
      } else {
        setPhase('locked')
      }
    } catch {
      // Network failure — keep the user on the lock screen if we have an owner, otherwise setup
      setPhase((p) => (p === 'loading' ? 'setup' : p))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // After unlocking or setup completes, fetch the full owner profile (incl. hint + createdAt)
  useEffect(() => {
    if (phase !== 'unlocked') return
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        setOwnerInfo({
          id: d.owner.id,
          name: d.owner.name,
          autoLockMinutes: d.owner.autoLockMinutes,
          passwordHint: d.owner.passwordHint,
          createdAt: d.owner.createdAt,
        })
      })
      .catch(() => {})
  }, [phase])

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 text-muted-foreground"
        >
          <ShieldCheck className="h-8 w-8 text-primary animate-pulse" />
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Securing the vault…
          </div>
        </motion.div>
      </div>
    )
  }

  if (phase === 'setup') {
    return <SetupScreen onDone={() => void refresh()} />
  }

  if (phase === 'locked') {
    return (
      <LockScreen
        ownerName={status?.owner?.name}
        initialLockMs={status?.lock?.remainingMs ?? 0}
        hint={status?.owner?.passwordHint ?? undefined}
        onUnlocked={() => void refresh()}
      />
    )
  }

  if (phase === 'unlocked' && ownerInfo) {
    return <Dashboard owner={ownerInfo} onLock={() => void refresh()} />
  }

  // Fallback (should not happen)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <button onClick={() => void refresh()} className="text-sm underline">
        Reload vault
      </button>
    </div>
  )
}
