'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Loader2,
  UserPlus,
  Pencil,
  Clock,
  Building2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '../../format'
import { DAY_NAMES, DAY_NAMES_FULL } from './schedule-helpers'

interface ScheduleEntry {
  dayOfWeek: number
  startTime: string
  endTime: string
  isWorking: boolean
}

interface DoctorFormData {
  name: string
  specialization: string
  phone: string
  email: string
  consultationFee: string
  status: 'Active' | 'Inactive'
  departmentId: string
  schedule: ScheduleEntry[]
}

const DEFAULT_SCHEDULE: ScheduleEntry[] = Array.from({ length: 7 }, (_, day) => ({
  dayOfWeek: day,
  startTime: '09:00',
  endTime: '17:00',
  isWorking: day >= 1 && day <= 5, // Mon-Fri working by default
}))

const EMPTY: DoctorFormData = {
  name: '',
  specialization: '',
  phone: '',
  email: '',
  consultationFee: '0',
  status: 'Active',
  departmentId: '',
  schedule: DEFAULT_SCHEDULE,
}

interface Department { id: string; name: string }

interface Props {
  mode: 'add' | 'edit'
  doctorId?: string
  onBack: () => void
  onSaved: (id: string) => void
}

export function DoctorFormView({ mode, doctorId, onBack, onSaved }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<DoctorFormData>(EMPTY)
  const [departments, setDepartments] = useState<Department[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)
  const [doctorCode, setDoctorCode] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/departments')
        if (res.ok) {
          const d = await res.json()
          setDepartments(d.departments)
        }
      } catch { /* ignore */ }
    })()
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !doctorId) return
    void (async () => {
      try {
        const res = await fetch(`/api/doctors/${doctorId}`)
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        const d = data.doctor
        setDoctorCode(d.doctorCode)
        // Build a complete 7-day schedule from the loaded rows
        const byDay = new Map<number, ScheduleEntry>()
        for (const s of d.schedule) {
          byDay.set(s.dayOfWeek, {
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime ?? '09:00',
            endTime: s.endTime ?? '17:00',
            isWorking: !!s.isWorking,
          })
        }
        const schedule: ScheduleEntry[] = Array.from({ length: 7 }, (_, day) => byDay.get(day) ?? {
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isWorking: false,
        })
        setForm({
          name: d.name ?? '',
          specialization: d.specialization ?? '',
          phone: d.phone ?? '',
          email: d.email ?? '',
          consultationFee: String(d.consultationFee ?? 0),
          status: d.status ?? 'Active',
          departmentId: d.departmentId ?? '',
          schedule,
        })
      } catch {
        toast({ title: 'Failed to load doctor', variant: 'destructive' })
        onBack()
      } finally {
        setLoading(false)
      }
    })()
  }, [mode, doctorId, toast, onBack])

  function update<K extends keyof DoctorFormData>(key: K, value: DoctorFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateSchedule(day: number, patch: Partial<ScheduleEntry>) {
    setForm((f) => ({
      ...f,
      schedule: f.schedule.map((s) => s.dayOfWeek === day ? { ...s, ...patch } : s),
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    // Validate working days have start < end
    for (const s of form.schedule) {
      if (s.isWorking && s.startTime >= s.endTime) {
        setError(`${DAY_NAMES_FULL[s.dayOfWeek]}: start time must be before end time`)
        return
      }
    }
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        specialization: form.specialization.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        consultationFee: parseFloat(form.consultationFee) || 0,
        status: form.status,
        departmentId: form.departmentId || null,
        schedule: form.schedule,
      }
      let res: Response
      if (mode === 'add') {
        res = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/doctors/${doctorId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast({
        title: mode === 'add' ? 'Doctor added' : 'Doctor updated',
        description: mode === 'add' ? data.doctor.doctorCode : undefined,
      })
      onSaved(data.doctor.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {mode === 'add' ? (
                <><UserPlus className="h-4 w-4" /> Add new doctor</>
              ) : (
                <><Pencil className="h-4 w-4" /> Edit doctor</>
              )}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {mode === 'add'
                ? 'Fill in the details. Doctor code is auto-generated on save.'
                : doctorCode}
            </CardDescription>
          </div>
          {mode === 'edit' && doctorCode && (
            <Badge variant="outline" className="font-mono">{doctorCode}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          {/* Personal */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="d-name">Name *</Label>
                <Input
                  id="d-name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Dr. Full name"
                  autoFocus={mode === 'add'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-spec">Specialization</Label>
                <Input
                  id="d-spec"
                  value={form.specialization}
                  onChange={(e) => update('specialization', e.target.value)}
                  placeholder="e.g. Cardiologist, MD"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-fee">Consultation fee ($)</Label>
                <Input
                  id="d-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.consultationFee}
                  onChange={(e) => update('consultationFee', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(parseFloat(form.consultationFee) || 0)} per visit
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-dept" className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Department
                </Label>
                <Select
                  value={form.departmentId || 'none'}
                  onValueChange={(v) => update('departmentId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger id="d-dept">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No department —</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mode === 'edit' && (
                <div className="space-y-1.5">
                  <Label htmlFor="d-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => update('status', v as 'Active' | 'Inactive')}
                  >
                    <SelectTrigger id="d-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-phone">Phone</Label>
                <Input
                  id="d-phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="+1 555 0100"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-email">Email</Label>
                <Input
                  id="d-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="doctor@clinic.com"
                />
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Weekly schedule
              </h3>
              <p className="text-xs text-muted-foreground">Toggle each day on/off and set working hours</p>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[80px_1fr_1fr_56px] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                <div>Day</div>
                <div>Start</div>
                <div>End</div>
                <div className="text-right">Working</div>
              </div>
              {form.schedule.map((s) => (
                <div
                  key={s.dayOfWeek}
                  className={`grid grid-cols-[80px_1fr_1fr_56px] gap-2 px-3 py-2 items-center border-t ${
                    s.isWorking ? '' : 'bg-muted/20'
                  }`}
                >
                  <div className="text-sm font-medium">{DAY_NAMES[s.dayOfWeek]}</div>
                  <Input
                    type="time"
                    value={s.startTime}
                    onChange={(e) => updateSchedule(s.dayOfWeek, { startTime: e.target.value })}
                    disabled={!s.isWorking}
                    className="h-8 text-sm"
                  />
                  <Input
                    type="time"
                    value={s.endTime}
                    onChange={(e) => updateSchedule(s.dayOfWeek, { endTime: e.target.value })}
                    disabled={!s.isWorking}
                    className="h-8 text-sm"
                  />
                  <div className="flex justify-end">
                    <Switch
                      checked={s.isWorking}
                      onCheckedChange={(v) => updateSchedule(s.dayOfWeek, { isWorking: v })}
                      aria-label={`Working on ${DAY_NAMES_FULL[s.dayOfWeek]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {mode === 'add' ? 'Add doctor' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
