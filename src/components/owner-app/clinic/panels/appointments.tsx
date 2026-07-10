'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  CalendarCheck,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarPlus,
  Stethoscope,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useQuickActions } from '../quick-actions-context'
import { formatDateTime, formatCurrency } from '../format'

interface Appointment {
  id: string
  patientId: string
  scheduledAt: string
  reason: string | null
  status: string
  fee: number
  createdAt: string
  patient: { id: string; name: string; phone: string | null }
  doctor?: {
    id: string
    name: string
    specialization: string | null
    department?: { name: string } | null
  } | null
}

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle2 className="h-3 w-3" />,
    cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="h-3 w-3" />,
    cls: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5',
  },
}

export function AppointmentsPanel() {
  const { openAction } = useQuickActions()
  const { toast } = useToast()
  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    try {
      const url = statusFilter !== 'all' ? `/api/appointments?status=${statusFilter}` : '/api/appointments'
      const res = await fetch(url)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setAppts(data.appointments)
    } catch {
      toast({ title: 'Failed to load appointments', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(id: string, status: string) {
    const prev = appts
    setAppts((p) => p.map((a) => (a.id === id ? { ...a, status } : a)))
    try {
      await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      toast({ title: `Marked as ${status}` })
    } catch {
      setAppts(prev)
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  async function deleteAppt(id: string) {
    const prev = appts
    setAppts((p) => p.filter((a) => a.id !== id))
    try {
      await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
      toast({ title: 'Appointment deleted' })
    } catch {
      setAppts(prev)
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Appointments
            <Badge variant="secondary" className="font-normal">{appts.length}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => openAction('book-appointment')} size="sm">
              <CalendarPlus className="h-3.5 w-3.5" />
              Book appointment
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : appts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">No appointments found.</p>
            <Button size="sm" variant="outline" onClick={() => openAction('book-appointment')}>
              <CalendarPlus className="h-3.5 w-3.5" />
              Book your first appointment
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {appts.map((a) => {
                  const meta = STATUS_META[a.status] ?? STATUS_META.pending
                  const isPast = new Date(a.scheduledAt).getTime() < Date.now()
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
                            <h3 className="font-medium text-sm">{a.patient.name}</h3>
                            <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                              {meta.icon}
                              {meta.label}
                            </Badge>
                            {a.fee > 0 && (
                              <Badge variant="outline" className="text-xs font-normal">
                                {formatCurrency(a.fee)}
                              </Badge>
                            )}
                            {a.doctor && (
                              <Badge variant="outline" className="text-xs font-normal gap-1">
                                <Stethoscope className="h-3 w-3" />
                                {a.doctor.name}
                              </Badge>
                            )}
                            {isPast && a.status === 'pending' && (
                              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(a.scheduledAt)}
                          </p>
                          {a.reason && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.reason}</p>
                          )}
                          {a.patient.phone && (
                            <p className="text-xs text-muted-foreground/70 mt-1">{a.patient.phone}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {a.status === 'pending' && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                onClick={() => updateStatus(a.id, 'completed')}
                                title="Mark completed"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-rose-600 hover:text-rose-700"
                                onClick={() => updateStatus(a.id, 'cancelled')}
                                title="Cancel"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {a.status === 'cancelled' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => updateStatus(a.id, 'pending')}
                              title="Reinstate"
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteAppt(a.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
    </Card>
  )
}
