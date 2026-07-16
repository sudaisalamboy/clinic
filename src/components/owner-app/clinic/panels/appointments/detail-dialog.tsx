'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  User,
  Stethoscope,
  Clock,
  Tag,
  Phone,
  Mail,
  Calendar,
  ArrowRight,
  XCircle,
  UserX,
  History,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDateTime, calculateAge } from '../../format'
import {
  type ApptStatus,
  STATUS_META,
  FLOW_STATUSES,
  nextStatus,
  isTerminal,
  isFlowStatus,
} from './status-helpers'

interface DetailPatient {
  id: string
  name: string
  phone: string | null
  email: string | null
  patientCode: string
  dateOfBirth: string | null
  gender: string | null
  bloodGroup: string | null
}
interface DetailDoctor {
  id: string
  name: string
  specialization: string | null
  department?: { name: string } | null
}
interface Appointment {
  id: string
  scheduledAt: string
  reason: string | null
  status: ApptStatus
  fee: number
  tokenNumber: string | null
  patient: DetailPatient
  doctor: DetailDoctor | null
}
interface HistoryItem {
  id: string
  scheduledAt: string
  status: ApptStatus
  reason: string | null
  fee: number
  tokenNumber: string | null
  doctor: { id: string; name: string; specialization: string | null } | null
}

interface Props {
  appointmentId: string | null
  onClose: () => void
}

export function AppointmentDetailDialog({ appointmentId, onClose }: Props) {
  const { toast } = useToast()
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!appointmentId) {
      setAppt(null)
      setHistory([])
      return
    }
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/appointments/${appointmentId}`)
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        setAppt(data.appointment)
        setHistory(data.history ?? [])
      } catch {
        toast({ title: 'Failed to load appointment', variant: 'destructive' })
        onClose()
      } finally {
        setLoading(false)
      }
    })()
  }, [appointmentId, toast, onClose])

  async function updateStatus(status: ApptStatus) {
    if (!appt) return
    setBusy(true)
    const prev = appt.status
    setAppt({ ...appt, status })
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({ title: `Marked as ${status}` })
    } catch {
      setAppt({ ...appt, status: prev })
      toast({ title: 'Failed to update status', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const open = !!appointmentId
  const status = appt?.status
  const next = status ? nextStatus(status) : null
  const terminal = status ? isTerminal(status) : false

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Appointment details
          </DialogTitle>
          <DialogDescription>
            {appt ? `Token ${appt.tokenNumber ?? '—'} · ${formatDateTime(appt.scheduledAt)}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {loading || !appt ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-3 max-h-[60vh]">
            <div className="space-y-4">
              {/* Status badge + advance button */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-sm font-normal ${(STATUS_META[appt.status] ?? STATUS_META.Scheduled).cls}`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${(STATUS_META[appt.status] ?? STATUS_META.Scheduled).dotCls}`} />
                  {appt.status}
                </Badge>
                <div className="flex items-center gap-1">
                  {next && isFlowStatus(appt.status) && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus(next)}
                      disabled={busy}
                      className="gap-1"
                    >
                      {next}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!terminal && appt.status !== 'Cancelled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700 border-rose-500/30"
                      onClick={() => updateStatus('Cancelled')}
                      disabled={busy}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                  {appt.status === 'Scheduled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-slate-600 hover:text-slate-800"
                      onClick={() => updateStatus('No Show')}
                      disabled={busy}
                    >
                      <UserX className="h-3.5 w-3.5" />
                      No Show
                    </Button>
                  )}
                </div>
              </div>

              {/* Status flow timeline */}
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Status flow</p>
                <div className="flex items-center gap-1">
                  {FLOW_STATUSES.map((s, i) => {
                    const idx = FLOW_STATUSES.indexOf(appt.status)
                    const done = idx >= i
                    const isCurrent = appt.status === s
                    const meta = STATUS_META[s]
                    return (
                      <div key={s} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                              isCurrent
                                ? `${meta.cls} ring-2 ring-offset-1 ring-offset-background`
                                : done
                                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600'
                                  : 'border-muted-foreground/20 text-muted-foreground/40'
                            }`}
                          >
                            {done && !isCurrent ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Circle className="h-3 w-3" />
                            )}
                          </div>
                          <span className={`text-[10px] ${isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                            {s}
                          </span>
                        </div>
                        {i < FLOW_STATUSES.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-emerald-500/40' : 'bg-muted-foreground/15'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Patient + doctor grid */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Patient
                  </p>
                  <p className="text-sm font-medium">{appt.patient.name}</p>
                  <p className="text-xs text-muted-foreground">{appt.patient.patientCode}</p>
                  <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {appt.patient.dateOfBirth && (
                      <p>DOB: {new Date(appt.patient.dateOfBirth).toLocaleDateString()} ({calculateAge(appt.patient.dateOfBirth)}y)</p>
                    )}
                    {appt.patient.gender && <p className="capitalize">{appt.patient.gender}</p>}
                    {appt.patient.bloodGroup && <p>Blood: {appt.patient.bloodGroup}</p>}
                    {appt.patient.phone && <p className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{appt.patient.phone}</p>}
                    {appt.patient.email && <p className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{appt.patient.email}</p>}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5" /> Doctor
                  </p>
                  {appt.doctor ? (
                    <>
                      <p className="text-sm font-medium">{appt.doctor.name}</p>
                      {appt.doctor.specialization && <p className="text-xs text-muted-foreground">{appt.doctor.specialization}</p>}
                      {appt.doctor.department && (
                        <Badge variant="outline" className="text-xs mt-1 font-normal">{appt.doctor.department.name}</Badge>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No doctor assigned</p>
                  )}
                </div>
              </div>

              {/* Appointment meta */}
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">When:</span>
                  <span className="font-medium">{formatDateTime(appt.scheduledAt)}</span>
                </div>
                {appt.tokenNumber && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Token:</span>
                    <Badge variant="outline" className="font-mono">{appt.tokenNumber}</Badge>
                  </div>
                )}
                {appt.fee > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Fee:</span>
                    <span className="font-medium">{formatCurrency(appt.fee)}</span>
                  </div>
                )}
                {appt.reason && (
                  <div>
                    <span className="text-muted-foreground">Reason:</span>
                    <p className="text-sm mt-0.5">{appt.reason}</p>
                  </div>
                )}
              </div>

              {/* Patient history */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Patient history
                </p>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-1">No previous appointments.</p>
                ) : (
                  <div className="space-y-1.5">
                    {history.slice(0, 8).map((h) => {
                      const meta = STATUS_META[h.status] ?? STATUS_META.Scheduled
                      return (
                        <div key={h.id} className="rounded-md border bg-card p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{formatDateTime(h.scheduledAt)}</span>
                            <Badge variant="outline" className={`text-[10px] font-normal ${meta.cls}`}>
                              {meta.label}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {h.doctor ? `Dr. ${h.doctor.name}` : 'No doctor'}
                            {h.reason ? ` · ${h.reason}` : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
