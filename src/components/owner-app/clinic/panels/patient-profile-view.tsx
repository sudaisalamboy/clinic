'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  RotateCcw,
  CalendarPlus,
  ReceiptText,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Droplet,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  FileText,
  StickyNote,
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
import { useQuickActions } from '../quick-actions-context'
import {
  calculateAge,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelative,
} from '../format'

interface BillItem { name: string; qty: number; price: number }
interface Appointment {
  id: string
  scheduledAt: string
  reason: string | null
  status: string
  fee: number
  bill: { id: string; total: number; status: string } | null
}
interface Bill {
  id: string
  items: BillItem[]
  total: number
  status: string
  createdAt: string
}
interface Patient {
  id: string
  patientCode: string
  name: string
  dateOfBirth: string | null
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
  bloodGroup: string | null
  notes: string | null
  status: string
  createdAt: string
  appointments: Appointment[]
  bills: Bill[]
  _count: { appointments: number; bills: number }
}

interface Props {
  patientId: string
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

export function PatientProfileView({ patientId, onBack, onEdit, onChanged }: Props) {
  const { toast } = useToast()
  const { openAction } = useQuickActions()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPatient(data.patient)
    } catch {
      toast({ title: 'Failed to load patient', variant: 'destructive' })
      onBack()
    } finally {
      setLoading(false)
    }
  }, [patientId, toast, onBack])

  useEffect(() => {
    void load()
  }, [patientId, load])

  async function toggleStatus() {
    if (!patient) return
    const next = patient.status === 'Active' ? 'Inactive' : 'Active'
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({
        title: next === 'Inactive' ? 'Patient deactivated' : 'Patient restored',
      })
      void load()
      onChanged()
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  async function hardDelete() {
    setConfirmDelete(false)
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardDelete: true }),
      })
      if (!res.ok) throw new Error('delete failed')
      toast({ title: 'Patient permanently deleted' })
      onChanged()
      onBack()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  if (loading || !patient) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const age = calculateAge(patient.dateOfBirth)
  const inactive = patient.status === 'Inactive'
  const totalBilled = patient.bills.reduce((s, b) => s + b.total, 0)
  const totalPaid = patient.bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.total, 0)
  const totalPending = totalBilled - totalPaid
  const completedAppts = patient.appointments.filter((a) => a.status === 'completed').length

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
                <CardTitle className="text-xl">{patient.name}</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">{patient.patientCode}</Badge>
                <Badge
                  variant="outline"
                  className={`text-xs font-normal ${
                    inactive
                      ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5'
                      : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                  }`}
                >
                  {patient.status}
                </Badge>
              </div>
              <CardDescription className="text-sm mt-1">
                Registered {formatRelative(patient.createdAt)} ·{' '}
                {patient._count.appointments} appointment{patient._count.appointments === 1 ? '' : 's'} ·{' '}
                {patient._count.bills} bill{patient._count.bills === 1 ? '' : 's'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={() => openAction('book-appointment')}>
                <CalendarPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Book</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction('generate-bill')}>
                <ReceiptText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bill</span>
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
                <User className="h-4 w-4" /> Demographics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Date of birth" value={patient.dateOfBirth ? `${formatDate(patient.dateOfBirth)}${age != null ? ` (${age}y)` : ''}` : '—'} />
              <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Age" value={age != null ? `${age} years` : '—'} />
              <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Gender" value={patient.gender ? <span className="capitalize">{patient.gender}</span> : '—'} />
              <DetailRow icon={<Droplet className="h-3.5 w-3.5" />} label="Blood group" value={patient.bloodGroup ?? '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="h-4 w-4" /> Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={patient.phone ?? '—'} />
              <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={patient.email ?? '—'} />
              <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={patient.address ?? '—'} />
            </CardContent>
          </Card>

          {patient.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <StickyNote className="h-4 w-4" /> Medical notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{patient.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: stats + medical history */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Visits" value={String(patient._count.appointments)} icon={<CalendarPlus className="h-3.5 w-3.5" />} tone="violet" />
            <StatTile label="Completed" value={String(completedAppts)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="emerald" />
            <StatTile label="Total billed" value={formatCurrency(totalBilled)} icon={<FileText className="h-3.5 w-3.5" />} tone="amber" />
            <StatTile label="Outstanding" value={formatCurrency(totalPending)} icon={<DollarSign className="h-3.5 w-3.5" />} tone={totalPending > 0 ? 'rose' : 'slate'} />
          </div>

          {/* Medical history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Medical history
              </CardTitle>
              <CardDescription className="text-sm">
                Appointments and bills for this patient, most recent first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="appointments">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="appointments" className="gap-1.5">
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Appointments ({patient.appointments.length})
                  </TabsTrigger>
                  <TabsTrigger value="bills" className="gap-1.5">
                    <ReceiptText className="h-3.5 w-3.5" />
                    Bills ({patient.bills.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="appointments" className="mt-0">
                  {patient.appointments.length === 0 ? (
                    <EmptyState
                      icon={<CalendarPlus className="h-8 w-8" />}
                      title="No appointments yet"
                      cta="Book appointment"
                      onCta={() => openAction('book-appointment')}
                    />
                  ) : (
                    <ScrollArea className="max-h-[60vh] pr-3">
                      <div className="space-y-2">
                        {patient.appointments.map((a, i) => {
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
                                    <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                                      {meta.icon}
                                      {meta.label}
                                    </Badge>
                                    {a.fee > 0 && (
                                      <Badge variant="outline" className="text-xs font-normal">
                                        {formatCurrency(a.fee)}
                                      </Badge>
                                    )}
                                    {a.bill && (
                                      <Badge variant="outline" className={`text-xs font-normal ${a.bill.status === 'paid' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/40 text-amber-600 dark:text-amber-400'}`}>
                                        Bill {a.bill.status === 'paid' ? 'paid' : 'pending'} · {formatCurrency(a.bill.total)}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium mt-1">{formatDateTime(a.scheduledAt)}</p>
                                  {a.reason && (
                                    <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="bills" className="mt-0">
                  {patient.bills.length === 0 ? (
                    <EmptyState
                      icon={<ReceiptText className="h-8 w-8" />}
                      title="No bills yet"
                      cta="Generate bill"
                      onCta={() => openAction('generate-bill')}
                    />
                  ) : (
                    <ScrollArea className="max-h-[60vh] pr-3">
                      <div className="space-y-2">
                        {patient.bills.map((b, i) => (
                          <motion.div
                            key={b.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(i * 0.04, 0.2) }}
                            className="rounded-lg border bg-card p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={`text-xs font-normal ${b.status === 'paid' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' : 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5'}`}>
                                    {b.status === 'paid' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                    {b.status === 'paid' ? 'Paid' : 'Pending'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</span>
                                </div>
                                <div className="mt-2 space-y-0.5">
                                  {b.items.map((it, j) => (
                                    <div key={j} className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">
                                        {it.name} <span className="text-muted-foreground/70">× {it.qty}</span>
                                      </span>
                                      <span className="tabular-nums">{formatCurrency(it.qty * it.price)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-semibold tabular-nums">{formatCurrency(b.total)}</div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
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
                Permanently delete this patient and all their records. This cannot be undone.
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
            <AlertDialogTitle>Delete {patient.name} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the patient and all their appointments and bills from the database. This action is irreversible.
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

function EmptyState({
  icon,
  title,
  cta,
  onCta,
}: {
  icon: React.ReactNode
  title: string
  cta: string
  onCta: () => void
}) {
  return (
    <div className="text-center py-10 text-muted-foreground">
      <div className="inline-flex opacity-40 mb-2">{icon}</div>
      <p className="text-sm mb-3">{title}</p>
      <Button size="sm" variant="outline" onClick={onCta}>
        {cta}
      </Button>
    </div>
  )
}
