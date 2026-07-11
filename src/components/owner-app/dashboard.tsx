'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Lock,
  LogOut,
  Shield,
  Clock,
  LayoutGrid,
  StickyNote,
  Link2,
  Settings as SettingsIcon,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useIdleTimer } from './use-idle-timer'
import { OverviewPanel } from './panels/overview'
import { NotesPanel } from './panels/notes'
import { LinksPanel } from './panels/links'
import { SettingsPanel } from './panels/settings'
import { ActivityPanel } from './panels/activity'

interface OwnerInfo {
  id: string
  name: string
  autoLockMinutes: number
  passwordHint?: string | null
  createdAt?: string | Date
}

interface Props {
  owner: OwnerInfo
  onLock: () => void
}

function fmtRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s >= 60) {
    const m = Math.floor(s / 60)
    const rs = s % 60
    return `${m}:${rs.toString().padStart(2, '0')}`
  }
  return `0:${s.toString().padStart(2, '0')}`
}

export function Dashboard({ owner, onLock }: Props) {
  const [autoLockMs, setAutoLockMs] = useState(owner.autoLockMinutes * 60 * 1000)
  const [tab, setTab] = useState('overview')

  const extend = useCallback(async () => {
    try {
      const res = await fetch('/api/extend', { method: 'POST' })
      if (!res.ok) throw new Error('extend failed')
      const data = await res.json()
      if (data.autoLockMinutes) {
        setAutoLockMs(data.autoLockMinutes * 60 * 1000)
      }
    } catch {
      // ignore
    }
  }, [])

  const { remainingMs } = useIdleTimer(autoLockMs, onLock)

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void extend()
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [extend])

  const warning = remainingMs <= 60_000
  const danger = remainingMs <= 15_000

  async function handleManualLock() {
    try {
      await fetch('/api/lock', { method: 'POST' })
    } catch {
      // ignore
    }
    onLock()
  }

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    onLock()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 shrink-0">
              <Shield className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Owner Vault</p>
              <p className="text-xs text-muted-foreground truncate">{owner.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`hidden sm:inline-flex tabular-nums font-mono gap-1.5 ${
                danger
                  ? 'border-destructive/50 text-destructive bg-destructive/5'
                  : warning
                    ? 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                    : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
              }`}
              title="Time until auto-lock"
            >
              <Clock className="h-3 w-3" />
              {fmtRemaining(remainingMs)}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleManualLock} className="gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6 h-auto">
            <TabsTrigger value="overview" className="gap-1.5 py-2">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 py-2">
              <StickyNote className="h-3.5 w-3.5" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5 py-2">
              <Link2 className="h-3.5 w-3.5" />
              Links
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 py-2">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 py-2">
              <SettingsIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="overview" className="mt-0">
              <OverviewPanel owner={owner} onGoTo={setTab} />
            </TabsContent>
            <TabsContent value="notes" className="mt-0">
              <NotesPanel />
            </TabsContent>
            <TabsContent value="links" className="mt-0">
              <LinksPanel />
            </TabsContent>
            <TabsContent value="activity" className="mt-0">
              <ActivityPanel />
            </TabsContent>
            <TabsContent value="settings" className="mt-0">
              <SettingsPanel owner={owner} onAutoLockChange={(m) => setAutoLockMs(m * 60 * 1000)} onLock={onLock} />
            </TabsContent>
          </motion.div>
        </Tabs>
      </main>

      <footer className="mt-auto border-t bg-background/60 py-4 text-center text-xs text-muted-foreground">
        <p>Single-owner vault. Auto-locks after {owner.autoLockMinutes}m of inactivity.</p>
      </footer>
    </div>
  )
}
