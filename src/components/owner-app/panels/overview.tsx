'use client'

import { useEffect, useState } from 'react'
import {
  StickyNote,
  Link2,
  Activity,
  Shield,
  Clock,
  ArrowRight,
  Loader2,
  KeyRound,
  Smartphone,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Stats {
  notes: number
  links: number
  activeSessions: number
}

interface Props {
  owner: { id: string; name: string; autoLockMinutes: number; createdAt?: string | Date }
  onGoTo: (tab: string) => void
}

export function OverviewPanel({ owner, onGoTo }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/logs')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setStats(d.stats))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const created = owner.createdAt ? new Date(owner.createdAt) : null
  const createdStr = created
    ? created.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Welcome back, {owner.name}</CardTitle>
                <CardDescription className="mt-1">
                  This is your private vault. Everything here is locked behind your password.
                </CardDescription>
              </div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile
                icon={<StickyNote className="h-4 w-4" />}
                label="Notes"
                value={loading ? '—' : String(stats?.notes ?? 0)}
                onClick={() => onGoTo('notes')}
              />
              <StatTile
                icon={<Link2 className="h-4 w-4" />}
                label="Links"
                value={loading ? '—' : String(stats?.links ?? 0)}
                onClick={() => onGoTo('links')}
              />
              <StatTile
                icon={<Smartphone className="h-4 w-4" />}
                label="Active sessions"
                value={loading ? '—' : String(stats?.activeSessions ?? 0)}
                onClick={() => onGoTo('settings')}
              />
              <StatTile
                icon={<Clock className="h-4 w-4" />}
                label="Auto-lock"
                value={`${owner.autoLockMinutes}m`}
                onClick={() => onGoTo('settings')}
              />
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <QuickAction
          icon={<StickyNote className="h-4 w-4" />}
          title="Capture a note"
          description="Quickly jot down a private thought or reminder."
          cta="Open notes"
          onClick={() => onGoTo('notes')}
        />
        <QuickAction
          icon={<Link2 className="h-4 w-4" />}
          title="Save a link"
          description="Bookmark something private for later."
          cta="Open links"
          onClick={() => onGoTo('links')}
        />
        <QuickAction
          icon={<KeyRound className="h-4 w-4" />}
          title="Change password"
          description="Rotate your vault password periodically."
          cta="Open settings"
          onClick={() => onGoTo('settings')}
        />
        <QuickAction
          icon={<Activity className="h-4 w-4" />}
          title="Review activity"
          description="See sign-in attempts and recent actions."
          cta="Open activity"
          onClick={() => onGoTo('activity')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About this vault</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            This app is private to a single owner — you. There are no other users, no roles, and no sign-up.
            The vault was sealed on <span className="text-foreground font-medium">{createdStr}</span>.
          </p>
          <p>
            The app will auto-lock after <span className="text-foreground font-medium">{owner.autoLockMinutes} minutes</span> of inactivity,
            and after too many failed attempts it will lock itself down for 15 minutes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border bg-card p-3 hover:bg-accent/40 transition"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </button>
  )
}

function QuickAction({
  icon,
  title,
  description,
  cta,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  onClick: () => void
}) {
  return (
    <Card className="hover:bg-accent/30 transition cursor-pointer" onClick={onClick}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            {icon}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className="text-base mt-3">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary" className="cursor-pointer">{cta}</Badge>
      </CardContent>
    </Card>
  )
}
