'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Loader2, RefreshCw, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoginScreen } from '@/components/clinic/login-screen'
import { SetupScreen } from '@/components/clinic/setup-screen'
import { AppShell } from '@/components/clinic/app-shell'

type Phase = 'loading' | 'login' | 'setup' | 'app' | 'error'

interface Status {
  authenticated: boolean
  user: { id: string; name: string; role: string } | null
  settings: { clinicName: string; currency: string } | null
  needsSetup?: boolean
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<Status | null>(null)

  const refresh = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/auth/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('status failed')
      const data: Status = await res.json()
      setStatus(data)
      if (data.authenticated && data.user) {
        setPhase('app')
      } else if (data.needsSetup) {
        // First run: no accounts exist yet — create the initial admin.
        setPhase('setup')
      } else {
        setPhase('login')
      }
    } catch {
      // A network/server failure is NOT the same as "signed out" — show
      // an explicit error state with a retry instead of silently dumping
      // the user on the login screen.
      setPhase('error')
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
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Stethoscope className="h-10 w-10 text-emerald-600" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 text-sm"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading clinic system…
          </motion.div>
        </motion.div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">
              Couldn&rsquo;t reach the clinic system
            </h1>
            <p className="text-sm text-muted-foreground">
              The server didn&rsquo;t respond. Check your connection and try again.
            </p>
          </div>
          <Button onClick={() => void refresh()} className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
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
