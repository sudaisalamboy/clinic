'use client'

import { useEffect, useState } from 'react'
import { Loader2, CalendarPlus, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useQuickActions } from './quick-actions-context'
import { defaultAppointmentTime } from './format'

interface PatientOption {
  id: string
  name: string
  phone?: string | null
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
  onPatientsChange?: () => void
  onBooked?: () => void
}

export function BookAppointmentDialog({ patients, doctors, onPatientsChange, onBooked }: Props) {
  const { open, openAction, close } = useQuickActions()
  const isOpen = open === 'book-appointment'
  const { toast } = useToast()

  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [scheduledAt, setScheduledAt] = useState(defaultAppointmentTime())
  const [reason, setReason] = useState('')
  const [fee, setFee] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPatientId(patients[0]?.id ?? '')
      setDoctorId('')
      setScheduledAt(defaultAppointmentTime())
      setReason('')
      setFee('')
      setError(null)
    }
  }, [isOpen, patients])

  // When a doctor is selected, auto-fill the fee from their consultationFee
  useEffect(() => {
    if (!doctorId) return
    const doc = doctors.find((d) => d.id === doctorId)
    if (doc && !fee) {
      setFee(String(doc.consultationFee))
    }
  }, [doctorId, doctors, fee])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Please select a patient')
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
          status: 'pending',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to book appointment')
      toast({ title: 'Appointment booked' })
      onBooked?.()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" />
            Book appointment
          </DialogTitle>
          <DialogDescription>
            Schedule a new appointment for an existing patient.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="a-patient">Patient</Label>
            <div className="flex gap-2">
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="a-patient" className="flex-1">
                  <SelectValue placeholder={patients.length === 0 ? 'No patients yet' : 'Select patient'} />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.phone ? ` · ${p.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Add a new patient first"
                onClick={() => openAction('add-patient')}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            {patients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No patients yet. Click the + button to add one.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-doctor">Doctor (optional)</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger id="a-doctor">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
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
          <div className="space-y-1.5">
            <Label htmlFor="a-when">When</Label>
            <Input
              id="a-when"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-reason">Reason / notes</Label>
            <Textarea
              id="a-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Consultation, follow-up, etc."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-fee">Consultation fee ($)</Label>
            <Input
              id="a-fee"
              type="number"
              min={0}
              step="0.01"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0.00"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !patientId}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Book appointment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
