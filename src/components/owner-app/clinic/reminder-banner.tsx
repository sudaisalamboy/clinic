'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Clock,
  UserCheck,
  X,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime } from './format'

interface ReminderAppt {
  id: string
  scheduledAt: string
  tokenNumber: string | null
  patient: { id: string; name: string }
  doctor: { id: string; name: string } | null
}

interface ReminderData {
  upcoming: ReminderAppt[]
  waiting: ReminderAppt[]
  stats: { total: number; byStatus: Record<string, number> }
}

interface Props {
  refreshKey: number
  onOpenAppointment?: (id: string) => void
}

export function ReminderBanner({ refreshKey, onOpenAppointment }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<ReminderData | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/appointments/reminders')
        if (!res.ok) return
        const d: ReminderData = await res.json()
        setData(d)
        setDismissed(false)
      } catch {
        // silent
      }
    })()
  }, [refreshKey])

  if (!data || dismissed) return null
  if (data.upcoming.length === 0 && data.waiting.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-4 w-4 text-primary" />
            {(data.upcoming.length + data.waiting.length) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
            )}
          </div>
          <span className="text-sm font-medium">Appointment reminders</span>
          <Badge variant="secondary" className="font-normal">
            {data.upcoming.length + data.waiting.length}
          </Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setDismissed(true)}
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="p-3 space-y-2">
        {data.upcoming.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Upcoming (next 2 hours)
            </p>
            <div className="space-y-1">
              {data.upcoming.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  onClick={() => onOpenAppointment?.(a.id)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-card hover:bg-accent/40 transition text-sm"
                >
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {a.tokenNumber && (
                    <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-4">
                      {a.tokenNumber}
                    </Badge>
                  )}
                  <span className="font-medium truncate flex-1">{a.patient.name}</span>
                  {a.doctor && <span className="text-xs text-muted-foreground truncate">Dr. {a.doctor.name}</span>}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
        {data.waiting.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <UserCheck className="h-3 w-3" /> Checked-in, waiting to complete
            </p>
            <div className="space-y-1">
              {data.waiting.slice(0, 3).map((a) => (
                <button
                  key={a.id}
                  onClick={() => onOpenAppointment?.(a.id)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 transition text-sm"
                >
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium truncate flex-1">{a.patient.name}</span>
                  {a.doctor && <span className="text-xs text-muted-foreground truncate">Dr. {a.doctor.name}</span>}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
              {data.waiting.length > 3 && (
                <p className="text-xs text-muted-foreground pl-2">+{data.waiting.length - 3} more waiting</p>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
