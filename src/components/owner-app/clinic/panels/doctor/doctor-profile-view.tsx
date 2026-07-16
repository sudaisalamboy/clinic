'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  RotateCcw,
  Loader2,
  Phone,
  Mail,
  Building2,
  Stethoscope,
  Clock,
  DollarSign,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  CalendarPlus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { useQuickActions } from '../../quick-actions-context'
import { formatCurrency, formatDateTime, formatDate } from '../../format'
import {
  DAY_NAMES,
  DAY_NAMES_FULL,
  formatTime,
  todayDayOfWeek,
  todaySchedule,
} from './schedule-helpers'

interface ScheduleEntry {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isWorking: boolean
}
interface Appointment {
  id: string
  scheduledAt: string
  reason: string | null
  status: string
  fee: number
  patient: { id: string; name: string; phone: string | null }
}
interface Doctor {
  id: string
  doctorCode: string
  name: string
  specialization: string | null
  phone: string | null
  email: string | null
  consultationFee: number
  status: string
  department: { id: string; name: string } | null
  schedule: ScheduleEntry[]
  appointments: Appointment[]
  _count: { appointments: number }
}

interface Props {
  doctorId: string
  onBack: () => void
  onEdit: () => void
  onChanged: () => void
}

const APPT_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5',
    icon: <Clock className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5',
    icon: <XCircle className="h-3 w-3" />,
  },
}

export function DoctorProfileView({ doctorId, onBack, onEdit, onChanged }: Props) {
  const { toast } = useToast()
  const { openAction } = useQuickActions()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [todays, setTodays] = useState<Appointment[]>([])
  const [recent, setRecent] = useState<Appointment[]>([])
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctors/${doctorId}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setDoctor(data.doctor)
      setTodays(data.todaysAppointments)
      setRecent(data.recentAppointments)
      setUpcoming(data.upcomingAppointments)
    } catch {
      toast({ title: 'Failed to load doctor', variant: 'destructive' })
      onBack()
    } finally {
      setLoading(false)
    }
  }, [doctorId, toast, onBack])

  useEffect(() => { void load() }, [load])

  async function toggleStatus() {
    if (!doctor) return
    const next = doctor.status === 'Active' ? 'Inactive' : 'Active'
    try {
      const res = await fetch(`/api/doctors/${doctorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({ title: next === 'Inactive' ? 'Doctor deactivated' : 'Doctor restored' })
      void load()
      onChanged()
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  async function hardDelete() {
    setConfirmDelete(false)
    try {
      const res = await fetch(`/api/doctors/${doctorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardDelete: true }),
      })
      if (!res.ok) throw new Error('delete failed')
      toast({ title: 'Doctor permanently deleted' })
      onChanged()
      onBack()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  if (loading || !doctor) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const inactive = doctor.status === 'Inactive'
  const today = todayDayOfWeek()
  const todaySlot = todaySchedule(doctor.schedule)
  const workingToday = !!todaySlot && todaySlot.isWorking && !!todaySlot.startTime && !!todaySlot.endTime
  const totalAppts = doctor._count.appointments
  const completedAppts = doctor.appointments.filter((a) => a.status === 'completed').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">{doctor.name}</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">{doctor.doctorCode}</Badge>
                <Badge
                  variant="outline"
                  className={`text-xs font-normal ${
                    inactive
                      ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5'
                      : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                  }`}
                >
                  {doctor.status}
                </Badge>
                {workingToday ? (
                  <Badge variant="outline" className="text-xs font-normal border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                    <Clock className="h-3 w-3" />
                    Today: {formatTime(todaySlot?.startTime ?? null)} – {formatTime(todaySlot?.endTime ?? null)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-normal border-muted text-muted-foreground">
                    Off today
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm mt-1">
                {doctor.specialization ?? 'No specialization set'}
                {doctor.department ? ` · ${doctor.department.name}` : ''}
                {' · '}
                {totalAppts} appointment{totalAppts === 1 ? '' : 's'} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={() => openAction('book-appointment')}>
                <CalendarPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Book</span>
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleStatus}
                className={inactive ? 'text-emerald-600 hover:text-emerald-700' : 'text-amber-600 hover:text-amber-700'}
              >
                {inactive ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{inactive ? 'Restore' : 'Deactivate'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left column: details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Stethoscope className="h-4 w-4" /> Professional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <DetailRow icon={<Stethoscope className="h-3.5 w-3.5" />} label="Specialization" value={doctor.specialization ?? '—'} />
              <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Department" value={doctor.department?.name ?? '—'} />
              <DetailRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Consultation fee" value={formatCurrency(doctor.consultationFee)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="h-4 w-4" /> Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={doctor.phone ?? '—'} />
              <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={doctor.email ?? '—'} />
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Weekly schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {doctor.schedule.map((s) => {
                const isToday = s.dayOfWeek === today
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between text-sm px-2.5 py-1.5 rounded-md ${
                      isToday ? 'bg-primary/10 ring-1 ring-primary/20' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isToday && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
                      <span className={isToday ? 'font-medium' : ''}>{DAY_NAMES[s.dayOfWeek]}</span>
                      {isToday && <span className="text-xs text-primary font-medium">Today</span>}
                    </span>
                    {s.isWorking ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Off</Badge>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right column: stats + appointments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Total visits" value={String(totalAppts)} icon={<CalendarCheck className="h-3.5 w-3.5" />} tone="violet" />
            <StatTile label="Completed" value={String(completedAppts)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="emerald" />
            <StatTile label="Today" value={String(todays.length)} icon={<Clock className="h-3.5 w-3.5" />} tone="amber" />
            <StatTile label="Fee/visit" value={formatCurrency(doctor.consultationFee)} icon={<DollarSign className="h-3.5 w-3.5" />} tone="slate" />
          </div>

          {/* Today's appointments (highlighted) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-amber-500" />
                Today's appointments
                <Badge variant="secondary" className="font-normal">{todays.length}</Badge>
              </CardTitle>
              <CardDescription className="text-sm">
                {workingToday
                  ? `Working hours: ${formatTime(todaySlot?.startTime ?? null)} – ${formatTime(todaySlot?.endTime ?? null)}`
                  : 'Not scheduled to work today.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todays.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm mb-3">No appointments scheduled for today.</p>
                  <Button size="sm" variant="outline" onClick={() => openAction('book-appointment')}>
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Book appointment
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {todays.map((a, i) => {
                    const meta = APPT_STATUS[a.status] ?? APPT_STATUS.pending
                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.2) }}
                        className="rounded-lg border bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{a.patient.name}</span>
                              <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                                {meta.icon}
                                {meta.label}
                              </Badge>
                              {a.fee > 0 && (
                                <Badge variant="outline" className="text-xs font-normal">{formatCurrency(a.fee)}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(a.scheduledAt)}
                            </p>
                            {a.reason && (
                              <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>
                            )}
                            {a.patient.phone && (
                              <p className="text-xs text-muted-foreground/70 mt-1">{a.patient.phone}</p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming + recent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">More appointments</CardTitle>
              <CardDescription className="text-sm">Upcoming and recent past visits.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upcoming">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="upcoming">
                    Upcoming ({upcoming.length})
                  </TabsTrigger>
                  <TabsTrigger value="recent">
                    Recent ({recent.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="upcoming" className="mt-0">
                  {upcoming.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">No upcoming appointments.</p>
                  ) : (
                    <ScrollArea className="max-h-[40vh] pr-3">
                      <div className="space-y-2">
                        {upcoming.map((a) => {
                          const meta = APPT_STATUS[a.status] ?? APPT_STATUS.pending
                          return (
                            <div key={a.id} className="rounded-lg border bg-card p-2.5 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{a.patient.name}</span>
                                <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                                  {meta.icon}
                                  {meta.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDateTime(a.scheduledAt)}
                                {a.reason ? ` · ${a.reason}` : ''}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
                <TabsContent value="recent" className="mt-0">
                  {recent.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">No recent appointments.</p>
                  ) : (
                    <ScrollArea className="max-h-[40vh] pr-3">
                      <div className="space-y-2">
                        {recent.map((a) => {
                          const meta = APPT_STATUS[a.status] ?? APPT_STATUS.pending
                          return (
                            <div key={a.id} className="rounded-lg border bg-card p-2.5 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{a.patient.name}</span>
                                <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                                  {meta.icon}
                                  {meta.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDateTime(a.scheduledAt)}
                                {a.reason ? ` · ${a.reason}` : ''}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-rose-500/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-4 w-4" /> Danger zone
              </CardTitle>
              <CardDescription className="text-sm">
                Permanently delete this doctor and their schedule. Past appointments will have their doctor field cleared.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="text-rose-600 hover:text-rose-700 border-rose-500/30" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete permanently
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {doctor.name} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the doctor and their schedule. Their past appointments will remain but the doctor link will be cleared. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={hardDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm break-words">{value}</div>
      </div>
    </div>
  )
}

const TONES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400' },
  slate:   { bg: 'bg-muted',           text: 'text-muted-foreground' },
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: keyof typeof TONES
}) {
  const t = TONES[tone]
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${t.bg} ${t.text}`}>
          {icon}
        </div>
      </div>
      <div className="text-lg font-semibold mt-1.5 tabular-nums">{value}</div>
    </div>
  )
}
