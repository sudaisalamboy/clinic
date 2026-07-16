'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Loader2,
  CalendarPlus,
  Search,
  User,
  Stethoscope,
  Clock,
  Tag,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, calculateAge } from '../../format'

interface PatientOption {
  id: string
  name: string
  phone: string | null
  patientCode: string
  dateOfBirth: string | null
}
interface DoctorOption {
  id: string
  name: string
  specialization: string | null
  consultationFee: number
  department?: { name: string } | null
}
interface Props {
  patients: PatientOption[]
  doctors: DoctorOption[]
  onBack: () => void
  onBooked: (id: string) => void
}

function pad(n: number) { return n.toString().padStart(2, '0') }

function defaultApptTime(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BookAppointmentView({ patients, doctors, onBack, onBooked }: Props) {
  const { toast } = useToast()
  const [patientQuery, setPatientQuery] = useState('')
  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [scheduledAt, setScheduledAt] = useState(defaultApptTime())
  const [reason, setReason] = useState('')
  const [fee, setFee] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filtered patients for the search dropdown
  const filteredPatients = patients.filter((p) => {
    if (!patientQuery.trim()) return true
    const q = patientQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q) ||
      p.patientCode.toLowerCase().includes(q)
    )
  }).slice(0, 20)

  // Auto-fill fee from doctor when doctor changes
  useEffect(() => {
    if (!doctorId) return
    const doc = doctors.find((d) => d.id === doctorId)
    if (doc && !fee) {
      setFee(String(doc.consultationFee))
    }
  }, [doctorId, doctors, fee])

  // Close patient dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function selectPatient(p: PatientOption) {
    setPatientId(p.id)
    setPatientQuery(`${p.name} · ${p.patientCode}`)
    setShowPatientDropdown(false)
  }

  const selectedPatient = patients.find((p) => p.id === patientId)
  const selectedDoctor = doctors.find((d) => d.id === doctorId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Please select a patient')
      return
    }
    if (!scheduledAt) {
      setError('Please pick a date and time')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId: doctorId || null,
          scheduledAt: new Date(scheduledAt).toISOString(),
          reason: reason.trim() || null,
          fee: fee ? parseFloat(fee) : 0,
          status: 'Scheduled',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to book appointment')
      toast({
        title: 'Appointment booked',
        description: `Token ${data.appointment.tokenNumber ?? '—'}${
          selectedDoctor ? ` · ${selectedDoctor.name}` : ''
        }`,
      })
      onBooked(data.appointment.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              Book appointment
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Token number is auto-generated. Doctor availability is checked automatically.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5 max-w-2xl">
          {/* Patient search + select */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Patient
            </h3>
            <div className="relative" ref={dropdownRef}>
              <Label htmlFor="patient-search" className="sr-only">Search patient</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="patient-search"
                  placeholder="Search by name, phone, or patient code…"
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value)
                    setPatientId('')
                    setShowPatientDropdown(true)
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              <AnimatePresence>
                {showPatientDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto"
                  >
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No patients found.
                      </div>
                    ) : (
                      filteredPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPatient(p)}
                          className="w-full text-left px-3 py-2 hover:bg-accent/40 transition border-b last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.patientCode}
                                {p.phone ? ` · ${p.phone}` : ''}
                                {p.dateOfBirth ? ` · ${calculateAge(p.dateOfBirth) ?? '?'}y` : ''}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {selectedPatient && (
              <div className="rounded-md border bg-emerald-500/5 border-emerald-500/20 p-2.5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div className="text-sm">
                  <span className="font-medium">{selectedPatient.name}</span>
                  <span className="text-muted-foreground"> · {selectedPatient.patientCode}</span>
                </div>
              </div>
            )}
            {patients.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                No patients registered yet. Add a patient first.
              </p>
            )}
          </section>

          {/* Doctor */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5" /> Doctor
            </h3>
            <Select value={doctorId || 'none'} onValueChange={(v) => setDoctorId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No doctor —</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.specialization ? ` · ${d.specialization}` : ''}
                    {d.department ? ` · ${d.department.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDoctor && (
              <p className="text-xs text-muted-foreground">
                Consultation fee: <span className="text-foreground font-medium">{formatCurrency(selectedDoctor.consultationFee)}</span>
              </p>
            )}
          </section>

          {/* Date & time */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> When
            </h3>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The system will check the doctor's working hours and existing appointments.
            </p>
          </section>

          {/* Reason + fee */}
          <section className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason / notes</Label>
              <Textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Consultation, follow-up, lab review…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee" className="flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Fee ($)
              </Label>
              <Input
                id="fee"
                type="number"
                min={0}
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !patientId}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Book appointment
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
