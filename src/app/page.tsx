'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Stethoscope } from 'lucide-react'
import { SetupScreen } from '@/components/clinic/setup-screen'
import { LoginScreen } from '@/components/clinic/login-screen'
import { AppShell } from '@/components/clinic/app-shell'

type Phase = 'loading' | 'setup' | 'login' | 'app'

interface Status {
  usersExist: boolean
  authenticated: boolean
  user: { id: string; name: string; role: string } | null
  settings: { clinicName: string; currency: string } | null
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<Status | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('status failed')
      const data: Status = await res.json()
      setStatus(data)
      if (!data.usersExist) {
        setPhase('setup')
      } else if (data.authenticated && data.user) {
        setPhase('app')
      } else {
        setPhase('login')
      }
    } catch {
      setPhase((p) => (p === 'loading' ? 'setup' : p))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 text-muted-foreground"
        >
          <Stethoscope className="h-8 w-8 text-emerald-600 animate-pulse" />
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading clinic system…
          </div>
        </motion.div>
      </div>
    )
  }

  if (phase === 'setup') {
    return <SetupScreen onDone={() => void refresh()} />
  }

  if (phase === 'login') {
    return (
      <LoginScreen
        clinicName={status?.settings?.clinicName}
        onDone={() => void refresh()}
      />
    )
  }

  if (phase === 'app' && status?.user) {
    return <AppShell user={status.user} onLogout={() => void refresh()} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <button onClick={() => void refresh()} className="text-sm underline">
        Reload
      </button>
    </div>
  )
}
