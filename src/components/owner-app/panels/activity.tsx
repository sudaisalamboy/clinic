'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  LogIn,
  LogOut,
  Lock,
  KeyRound,
  Settings,
  Smartphone,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LogEntry {
  id: string
  action: string
  detail: string | null
  ip: string | null
  createdAt: string
}

interface Stats {
  notes: number
  links: number
  activeSessions: number
}

const ACTION_META: Record<string, { icon: React.ReactNode; tone: 'success' | 'danger' | 'neutral' | 'warning' }> = {
  setup: { icon: <ShieldCheck className="h-3.5 w-3.5" />, tone: 'success' },
  login: { icon: <LogIn className="h-3.5 w-3.5" />, tone: 'success' },
  login_failed: { icon: <AlertCircle className="h-3.5 w-3.5" />, tone: 'danger' },
  logout: { icon: <LogOut className="h-3.5 w-3.5" />, tone: 'neutral' },
  manual_lock: { icon: <Lock className="h-3.5 w-3.5" />, tone: 'warning' },
  password_change: { icon: <KeyRound className="h-3.5 w-3.5" />, tone: 'warning' },
  settings_update: { icon: <Settings className="h-3.5 w-3.5" />, tone: 'neutral' },
  revoke_sessions: { icon: <Smartphone className="h-3.5 w-3.5" />, tone: 'warning' },
}

const TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  neutral: 'bg-muted text-muted-foreground',
}

export function ActivityPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/logs')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        setLogs(d.logs)
        setStats(d.stats)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Notes" value={stats?.notes ?? '—'} />
        <StatCard label="Links" value={stats?.links ?? '—'} />
        <StatCard label="Active sessions" value={stats?.activeSessions ?? '—'} />
        <StatCard label="Log entries" value={logs.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity log
          </CardTitle>
          <CardDescription>The most recent 100 events in your vault.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No activity yet.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-2">
                {logs.map((log, i) => {
                  const meta = ACTION_META[log.action] ?? {
                    icon: <Activity className="h-3.5 w-3.5" />,
                    tone: 'neutral' as const,
                  }
                  const when = new Date(log.createdAt)
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.01, 0.2) }}
                      className="flex items-start gap-3 rounded-lg border bg-card p-3"
                    >
                      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${TONE_CLASS[meta.tone]}`}>
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{humanAction(log.action)}</span>
                          {log.ip && (
                            <Badge variant="outline" className="text-xs font-mono font-normal">{log.ip}</Badge>
                          )}
                        </div>
                        {log.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {when.toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function humanAction(action: string): string {
  const map: Record<string, string> = {
    setup: 'Vault created',
    login: 'Signed in',
    login_failed: 'Failed sign-in attempt',
    logout: 'Signed out',
    manual_lock: 'Manual lock',
    password_change: 'Password changed',
    settings_update: 'Settings updated',
    revoke_sessions: 'Other sessions revoked',
  }
  return map[action] ?? action
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
