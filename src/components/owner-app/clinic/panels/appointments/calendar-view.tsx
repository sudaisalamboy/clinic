'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarClock,
  Plus,
  Loader2,
  Stethoscope,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatTime } from '../doctor/schedule-helpers'
import { formatCurrency } from '../../format'
import {
  type ApptStatus,
  STATUS_META,
} from './status-helpers'

interface CalendarAppointment {
  id: string
  scheduledAt: string
  reason: string | null
  status: ApptStatus
  fee: number
  tokenNumber: string | null
  patient: { id: string; name: string; patientCode: string }
  doctor: { id: string; name: string; specialization: string | null } | null
}

interface Props {
  onBook: () => void
  onOpenAppointment: (id: string) => void
}

type View = 'month' | 'week' | 'day'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}
function startOfWeek(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}
function endOfWeek(d: Date) {
  const out = startOfWeek(d)
  out.setDate(out.getDate() + 6)
  out.setHours(23, 59, 59, 999)
  return out
}
function startOfDay(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}
function endOfDay(d: Date) {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

export function CalendarView({ onBook, onOpenAppointment }: Props) {
  const { toast } = useToast()
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(new Date())
  const [appts, setAppts] = useState<CalendarAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [doctorFilter, setDoctorFilter] = useState<string>('all')

  // Compute the date range for the current view
  const range = useMemo(() => {
    if (view === 'month') return { from: startOfMonth(cursor), to: endOfMonth(cursor) }
    if (view === 'week') return { from: startOfWeek(cursor), to: endOfWeek(cursor) }
    return { from: startOfDay(cursor), to: endOfDay(cursor) }
  }, [view, cursor])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      })
      if (doctorFilter !== 'all') params.set('doctorId', doctorFilter)
      const res = await fetch(`/api/appointments?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setAppts(data.appointments)
    } catch {
      toast({ title: 'Failed to load calendar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [range, doctorFilter, toast])

  useEffect(() => { void load() }, [load])

  function prev() {
    const c = new Date(cursor)
    if (view === 'month') c.setMonth(c.getMonth() - 1)
    else if (view === 'week') c.setDate(c.getDate() - 7)
    else c.setDate(c.getDate() - 1)
    setCursor(c)
  }
  function next() {
    const c = new Date(cursor)
    if (view === 'month') c.setMonth(c.getMonth() + 1)
    else if (view === 'week') c.setDate(c.getDate() + 7)
    else c.setDate(c.getDate() + 1)
  }
  function goToday() { setCursor(new Date()) }

  // Group appointments by day (yyyy-mm-dd)
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarAppointment[]>()
    for (const a of appts) {
      const d = new Date(a.scheduledAt)
      const key = fmtDate(d)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(a)
    }
    // Sort each day's appts by time
    for (const [, list] of m) {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }
    return m
  }, [appts])

  const headerLabel = useMemo(() => {
    if (view === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    if (view === 'week') {
      const s = startOfWeek(cursor)
      const e = endOfWeek(cursor)
      return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }, [view, cursor])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </CardTitle>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="inline-flex rounded-md border overflow-hidden">
              <Button
                size="sm"
                variant={view === 'month' ? 'default' : 'ghost'}
                onClick={() => setView('month')}
                className="rounded-none"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Month</span>
              </Button>
              <Button
                size="sm"
                variant={view === 'week' ? 'default' : 'ghost'}
                onClick={() => setView('week')}
                className="rounded-none"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Week</span>
              </Button>
              <Button
                size="sm"
                variant={view === 'day' ? 'default' : 'ghost'}
                onClick={() => setView('day')}
                className="rounded-none"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Day</span>
              </Button>
            </div>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue placeholder="All doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onBook}>
              <Plus className="h-3.5 w-3.5" />
              Book
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={prev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">{headerLabel}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={next}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : view === 'month' ? (
          <MonthGrid cursor={cursor} byDay={byDay} onOpenAppointment={onOpenAppointment} />
        ) : view === 'week' ? (
          <WeekGrid cursor={cursor} byDay={byDay} onOpenAppointment={onOpenAppointment} onBook={onBook} />
        ) : (
          <DayList cursor={cursor} byDay={byDay} onOpenAppointment={onOpenAppointment} onBook={onBook} />
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Month grid ----------

function MonthGrid({
  cursor,
  byDay,
  onOpenAppointment,
}: {
  cursor: Date
  byDay: Map<string, CalendarAppointment[]>
  onOpenAppointment: (id: string) => void
}) {
  const today = new Date()
  const first = startOfMonth(cursor)
  const last = endOfMonth(cursor)
  // Build 6 weeks (42 cells) starting from the Sunday before `first`
  const gridStart = new Date(first)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    cells.push(d)
  }
  const inMonth = (d: Date) => d.getMonth() === cursor.getMonth()

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-xs font-medium text-muted-foreground text-center py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const key = fmtDate(d)
          const dayAppts = byDay.get(key) ?? []
          const isToday = sameDay(d, today)
          const inThisMonth = inMonth(d)
          return (
            <div
              key={i}
              className={`min-h-[88px] rounded-md border p-1.5 text-xs transition ${
                inThisMonth ? 'bg-card' : 'bg-muted/20 text-muted-foreground'
              } ${isToday ? 'border-primary ring-1 ring-primary/20' : ''}`}
            >
              <div className={`text-right font-medium ${isToday ? 'text-primary' : ''}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5 mt-0.5">
                {dayAppts.slice(0, 3).map((a) => {
                  const meta = STATUS_META[a.status] ?? STATUS_META.Scheduled
                  return (
                    <button
                      key={a.id}
                      onClick={() => onOpenAppointment(a.id)}
                      className="w-full text-left truncate px-1 py-0.5 rounded hover:bg-accent/50 transition flex items-center gap-1"
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${meta.dotCls}`} />
                      <span className="truncate">
                        {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {a.patient.name}
                      </span>
                    </button>
                  )
                })}
                {dayAppts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground pl-1">+{dayAppts.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Week grid ----------

function WeekGrid({
  cursor,
  byDay,
  onOpenAppointment,
  onBook,
}: {
  cursor: Date
  byDay: Map<string, CalendarAppointment[]>
  onOpenAppointment: (id: string) => void
  onBook: () => void
}) {
  const today = new Date()
  const start = startOfWeek(cursor)
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {days.map((d, i) => {
        const key = fmtDate(d)
        const dayAppts = byDay.get(key) ?? []
        const isToday = sameDay(d, today)
        return (
          <div
            key={i}
            className={`rounded-md border min-h-[200px] p-2 ${isToday ? 'border-primary ring-1 ring-primary/20' : ''}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <div className="text-xs text-muted-foreground">{WEEKDAYS[d.getDay()]}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onBook} title="Book">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {dayAppts.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">No appointments</p>
              ) : (
                dayAppts.map((a) => {
                  const meta = STATUS_META[a.status] ?? STATUS_META.Scheduled
                  return (
                    <button
                      key={a.id}
                      onClick={() => onOpenAppointment(a.id)}
                      className="w-full text-left p-1.5 rounded border bg-card hover:bg-accent/40 transition"
                    >
                      <div className="flex items-center gap-1">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${meta.dotCls}`} />
                        <span className="text-xs font-medium">
                          {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {a.tokenNumber && (
                          <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-3.5">
                            {a.tokenNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs truncate mt-0.5">{a.patient.name}</p>
                      {a.doctor && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{a.doctor.name}</p>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Day list ----------

function DayList({
  cursor,
  byDay,
  onOpenAppointment,
  onBook,
}: {
  cursor: Date
  byDay: Map<string, CalendarAppointment[]>
  onOpenAppointment: (id: string) => void
  onBook: () => void
}) {
  const today = new Date()
  const isToday = sameDay(cursor, today)
  const key = fmtDate(cursor)
  const dayAppts = byDay.get(key) ?? []

  // Group by hour for the day view
  const byHour = useMemo(() => {
    const m = new Map<number, CalendarAppointment[]>()
    for (const a of dayAppts) {
      const h = new Date(a.scheduledAt).getHours()
      if (!m.has(h)) m.set(h, [])
      m.get(h)!.push(a)
    }
    for (const [, list] of m) {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }
    return m
  }, [dayAppts])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {dayAppts.length} appointment{dayAppts.length === 1 ? '' : 's'} on{' '}
            {cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {isToday && <Badge className="mt-1">Today</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={onBook}>
          <Plus className="h-3.5 w-3.5" />
          Book appointment
        </Button>
      </div>
      {dayAppts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No appointments scheduled.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {Array.from({ length: 24 }, (_, h) => h).map((h) => {
            const hourAppts = byHour.get(h) ?? []
            if (hourAppts.length === 0) return null
            return (
              <div key={h} className="flex gap-3 py-1.5 border-b last:border-0">
                <div className="text-xs font-mono text-muted-foreground w-16 shrink-0 pt-1">
                  {h.toString().padStart(2, '0')}:00
                </div>
                <div className="flex-1 space-y-1">
                  {hourAppts.map((a) => {
                    const meta = STATUS_META[a.status] ?? STATUS_META.Scheduled
                    return (
                      <motion.button
                        key={a.id}
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => onOpenAppointment(a.id)}
                        className="w-full text-left p-2.5 rounded-md border bg-card hover:bg-accent/40 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {a.tokenNumber && (
                                <Badge variant="outline" className="text-xs font-mono">{a.tokenNumber}</Badge>
                              )}
                              <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                                {meta.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" /> {a.patient.name}
                              </span>
                              {a.doctor && (
                                <span className="inline-flex items-center gap-1">
                                  <Stethoscope className="h-3 w-3" /> {a.doctor.name}
                                </span>
                              )}
                              {a.fee > 0 && <span>{formatCurrency(a.fee)}</span>}
                            </div>
                            {a.reason && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{a.reason}</p>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
