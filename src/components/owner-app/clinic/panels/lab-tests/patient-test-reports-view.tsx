'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  ClipboardList,
  Eye,
  ArrowRight,
  Plus,
  User,
  Stethoscope,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDateTime, formatDate } from '../../format'
import {
  type PatientLabTest,
  type LabTestStatus,
  STATUS_META,
  nextStatus,
} from './lab-helpers'

interface PatientOption {
  id: string
  name: string
  patientCode: string
  phone: string | null
  dateOfBirth: string | null
}
interface DoctorOption {
  id: string
  name: string
  specialization: string | null
}
interface LabTestOption {
  id: string
  name: string
  category: string | null
  price: number
  status: string
}

interface Props {
  patients: PatientOption[]
  doctors: DoctorOption[]
  labTests: LabTestOption[]
  onOpenResult: (id: string) => void
  refreshKey: number
  onChanged: () => void
}

export function PatientTestReportsView({ patients, doctors, labTests, onOpenResult, refreshKey, onChanged }: Props) {
  const { toast } = useToast()
  const [tests, setTests] = useState<PatientLabTest[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAssign, setShowAssign] = useState(false)
  // Assign form state
  const [assignPatient, setAssignPatient] = useState('')
  const [assignTest, setAssignTest] = useState('')
  const [assignDoctor, setAssignDoctor] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/patient-tests?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setTests(data.patientTests)
    } catch {
      toast({ title: 'Failed to load patient tests', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [query, statusFilter, toast])

  useEffect(() => {
    const id = setTimeout(() => { void load() }, 300)
    return () => clearTimeout(id)
  }, [query, statusFilter, load])

  useEffect(() => { void load() }, [load, refreshKey])

  async function advanceStatus(t: PatientLabTest) {
    const next = nextStatus(t.status as LabTestStatus)
    if (!next) return
    setTests((prev) => prev.map((x) => x.id === t.id ? { ...x, status: next } : x))
    try {
      const res = await fetch(`/api/patient-tests/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({ title: `Marked as ${next}` })
    } catch {
      setTests((prev) => prev.map((x) => x.id === t.id ? { ...x, status: t.status } : x))
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  async function assignTest_submit(e: React.FormEvent) {
    e.preventDefault()
    setAssignError(null)
    if (!assignPatient) { setAssignError('Select a patient'); return }
    if (!assignTest) { setAssignError('Select a lab test'); return }
    setAssignBusy(true)
    try {
      const res = await fetch('/api/patient-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: assignPatient,
          labTestId: assignTest,
          doctorId: assignDoctor || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to assign test')
      toast({ title: 'Test assigned', description: data.patientTest.testNumber })
      setShowAssign(false)
      setAssignPatient('')
      setAssignTest('')
      setAssignDoctor('')
      onChanged()
      void load()
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign test')
    } finally {
      setAssignBusy(false)
    }
  }

  const activeLabTests = labTests.filter((t) => t.status === 'Active')

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Patient test reports
            <Badge variant="secondary" className="font-normal">{tests.length}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search test #, patient, test name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[240px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setShowAssign(true)}>
              <Plus className="h-3.5 w-3.5" />
              Assign test
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">{query || statusFilter !== 'all' ? 'No tests match your filters.' : 'No patient tests yet.'}</p>
            {!query && statusFilter === 'all' && (
              <Button size="sm" variant="outline" onClick={() => setShowAssign(true)}>
                <Plus className="h-3.5 w-3.5" />
                Assign first test
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {tests.map((t) => {
                  const status = t.status as LabTestStatus
                  const meta = STATUS_META[status] ?? STATUS_META.Pending
                  const next = nextStatus(status)
                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-lg border bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{t.testNumber}</span>
                            <span className="font-medium text-sm">{t.labTest.name}</span>
                            <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
                              {meta.label}
                            </Badge>
                            {t.labTest.category && (
                              <Badge variant="outline" className="text-xs font-normal">{t.labTest.category}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" /> {t.patient.name}
                              <span className="text-muted-foreground/70">({t.patient.patientCode})</span>
                            </span>
                            {t.doctor && (
                              <span className="inline-flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" /> {t.doctor.name}
                              </span>
                            )}
                            <span>{formatCurrency(t.labTest.price)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Requested {formatDateTime(t.requestedAt)}
                            {t.completedAt && ` · Completed ${formatDate(t.completedAt)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => onOpenResult(t.id)} title="View / Add result">
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{status === 'Completed' ? 'View' : 'Result'}</span>
                          </Button>
                          {next && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1"
                              onClick={() => advanceStatus(t)}
                              title={`Advance to ${next}`}
                            >
                              {next}
                              <ArrowRight className="h-3 w-3" />
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

      {/* Assign test dialog */}
      <Dialog open={showAssign} onOpenChange={(v) => !v && setShowAssign(false)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Assign lab test</DialogTitle>
            <DialogDescription>Select a patient and a test from the catalog. A test number is auto-generated.</DialogDescription>
          </DialogHeader>
          <form onSubmit={assignTest_submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <Select value={assignPatient} onValueChange={setAssignPatient}>
                <SelectTrigger><SelectValue placeholder={patients.length === 0 ? 'No patients yet' : 'Select patient'} /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.patientCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lab test</Label>
              <Select value={assignTest} onValueChange={setAssignTest}>
                <SelectTrigger><SelectValue placeholder={activeLabTests.length === 0 ? 'No tests in catalog' : 'Select test'} /></SelectTrigger>
                <SelectContent>
                  {activeLabTests.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {formatCurrency(t.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Doctor (optional)</Label>
              <Select value={assignDoctor || 'none'} onValueChange={(v) => setAssignDoctor(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{d.specialization ? ` · ${d.specialization}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignError && <p className="text-sm text-destructive">{assignError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAssign(false)} disabled={assignBusy}>Cancel</Button>
              <Button type="submit" disabled={assignBusy || !assignPatient || !assignTest}>
                {assignBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Assign test
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
