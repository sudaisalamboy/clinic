'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Stethoscope,
  Tag,
  ArrowRight,
  XCircle,
  UserX,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '../../format'
import {
  type ApptStatus,
  STATUS_META,
  ALL_STATUSES,
  nextStatus,
  isFlowStatus,
  isTerminal,
} from './status-helpers'

interface TodayAppointment {
  id: string
  scheduledAt: string
  reason: string | null
  status: ApptStatus
  fee: number
  tokenNumber: string | null
  patient: { id: string; name: string; phone: string | null; patientCode: string }
  doctor: { id: string; name: string; specialization: string | null; department?: { name: string } | null } | null
}

interface Props {
  onOpenAppointment: (id: string) => void
  onBook: () => void
}

export function TodayAppointmentsView({ onOpenAppointment, onBook }: Props) {
  const { toast } = useToast()
  const [appts, setAppts] = useState<TodayAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dayOffset, setDayOffset] = useState(0) // 0 = today, -1 = yesterday, 1 = tomorrow
  const [cancelTarget, setCancelTarget] = useState<TodayAppointment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = new Date()
      d.setDate(d.getDate() + dayOffset)
      d.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setHours(23, 59, 59, 999)
      const params = new URLSearchParams({
        from: d.toISOString(),
        to: end.toISOString(),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/appointments?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setAppts(data.appointments)
    } catch {
      toast({ title: 'Failed to load appointments', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [dayOffset, statusFilter, toast])

  useEffect(() => { void load() }, [load])

  // Sort by scheduled time ascending
  const sorted = [...appts].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  async function advanceStatus(a: TodayAppointment) {
    const next = nextStatus(a.status)
    if (!next) return
    // Optimistic
    setAppts((prev) => prev.map((x) => x.id === a.id ? { ...x, status: next } : x))
    try {
      const res = await fetch(`/api/appointments/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({ title: `Marked as ${next}` })
    } catch {
      setAppts((prev) => prev.map((x) => x.id === a.id ? { ...x, status: a.status } : x))
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  async function setStatus(a: TodayAppointment, status: ApptStatus) {
    setAppts((prev) => prev.map((x) => x.id === a.id ? { ...x, status } : x))
    setCancelTarget(null)
    try {
      const res = await fetch(`/api/appointments/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({ title: `Marked as ${status}` })
    } catch {
      setAppts((prev) => prev.map((x) => x.id === a.id ? { ...x, status: a.status } : x))
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  const dayLabel = (() => {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    if (dayOffset === 0) return 'Today'
    if (dayOffset === -1) return 'Yesterday'
    if (dayOffset === 1) return 'Tomorrow'
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  })()

  // Stats for the day
  const stats: Record<string, number> = {}
  for (const a of appts) {
    stats[a.status] = (stats[a.status] ?? 0) + 1
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            {dayLabel}
            <Badge variant="secondary" className="font-normal">{appts.length}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDayOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDayOffset(0)}>Today</Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDayOffset((o) => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Quick stats */}
        {appts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {ALL_STATUSES.filter((s) => stats[s]).map((s) => {
              const meta = STATUS_META[s]
              return (
                <Badge key={s} variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                  {meta.label}: {stats[s]}
                </Badge>
              )
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">
              {statusFilter !== 'all'
                ? `No ${statusFilter} appointments ${dayLabel.toLowerCase()}.`
                : `No appointments ${dayLabel.toLowerCase()}.`}
            </p>
            {dayOffset === 0 && (
              <Button size="sm" variant="outline" onClick={onBook}>
                <CalendarCheck className="h-3.5 w-3.5" />
                Book appointment
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {sorted.map((a) => {
                  const meta = STATUS_META[a.status] ?? STATUS_META.Scheduled
                  const next = nextStatus(a.status)
                  const terminal = isTerminal(a.status)
                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-lg border bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold tabular-nums">
                              {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {a.tokenNumber && (
                              <Badge variant="outline" className="text-xs font-mono font-normal">
                                <Tag className="h-3 w-3" />
                                {a.tokenNumber}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
                              {meta.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              {a.patient.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{a.patient.patientCode}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {a.doctor && (
                              <span className="inline-flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" />
                                {a.doctor.name}
                              </span>
                            )}
                            {a.fee > 0 && <span>{formatCurrency(a.fee)}</span>}
                            {a.patient.phone && <span>{a.patient.phone}</span>}
                          </div>
                          {a.reason && (
                            <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{a.reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onOpenAppointment(a.id)} title="View details">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {next && isFlowStatus(a.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => advanceStatus(a)}
                              className="h-7 gap-1"
                              title={`Advance to ${next}`}
                            >
                              {next}
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                          {!terminal && a.status !== 'Cancelled' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-600 hover:text-rose-700"
                              onClick={() => setCancelTarget(a)}
                              title="Cancel appointment"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {a.status === 'Scheduled' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-500 hover:text-slate-700"
                              onClick={() => setStatus(a, 'No Show')}
                              title="Mark as No Show"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.patient.name} on{' '}
              {cancelTarget ? new Date(cancelTarget.scheduledAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : ''}
              . The appointment will be marked as Cancelled. You can still see it in the calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelTarget && setStatus(cancelTarget, 'Cancelled')}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Cancel appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
