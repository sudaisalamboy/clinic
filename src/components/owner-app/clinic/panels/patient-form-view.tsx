'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Loader2,
  UserPlus,
  Pencil,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { calculateAge } from '../format'

interface PatientFormData {
  name: string
  dateOfBirth: string
  gender: 'male' | 'female' | 'other' | ''
  phone: string
  email: string
  address: string
  bloodGroup: string
  notes: string
  status: 'Active' | 'Inactive'
}

const EMPTY: PatientFormData = {
  name: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  bloodGroup: '',
  notes: '',
  status: 'Active',
}

interface Props {
  mode: 'add' | 'edit'
  /** When editing, the patient ID to load and update. */
  patientId?: string
  onBack: () => void
  onSaved: (id: string) => void
}

export function PatientFormView({ mode, patientId, onBack, onSaved }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<PatientFormData>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)
  const [patientCode, setPatientCode] = useState<string>('')

  // Load existing patient in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !patientId) return
    void (async () => {
      try {
        const res = await fetch(`/api/patients/${patientId}`)
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        const p = data.patient
        setPatientCode(p.patientCode)
        setForm({
          name: p.name ?? '',
          dateOfBirth: p.dateOfBirth ? toDateInput(p.dateOfBirth) : '',
          gender: p.gender ?? '',
          phone: p.phone ?? '',
          email: p.email ?? '',
          address: p.address ?? '',
          bloodGroup: p.bloodGroup ?? '',
          notes: p.notes ?? '',
          status: p.status ?? 'Active',
        })
      } catch {
        toast({ title: 'Failed to load patient', variant: 'destructive' })
        onBack()
      } finally {
        setLoading(false)
      }
    })()
  }, [mode, patientId, toast, onBack])

  const age = calculateAge(form.dateOfBirth || null)

  function update<K extends keyof PatientFormData>(key: K, value: PatientFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        bloodGroup: form.bloodGroup || null,
        notes: form.notes.trim() || null,
        status: form.status,
      }

      let res: Response
      if (mode === 'add') {
        res = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/patients/${patientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast({
        title: mode === 'add' ? 'Patient added' : 'Patient updated',
        description: mode === 'add' ? data.patient.patientCode : undefined,
      })
      onSaved(data.patient.id)
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
                <><UserPlus className="h-4 w-4" /> Add new patient</>
              ) : (
                <><Pencil className="h-4 w-4" /> Edit patient</>
              )}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {mode === 'add'
                ? 'Fill in the details below. Patient code is auto-generated on save.'
                : patientCode}
            </CardDescription>
          </div>
          {mode === 'edit' && patientCode && (
            <Badge variant="outline" className="font-mono">{patientCode}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          {/* Personal */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-name">Name *</Label>
                <Input
                  id="f-name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Full name"
                  autoFocus={mode === 'add'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-dob" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Date of birth
                </Label>
                <Input
                  id="f-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => update('dateOfBirth', e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                {form.dateOfBirth && (
                  <p className="text-xs text-muted-foreground">
                    Age: <span className="text-foreground font-medium">{age != null ? `${age} years` : 'invalid date'}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-gender">Gender</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => update('gender', v as PatientFormData['gender'])}
                >
                  <SelectTrigger id="f-gender">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-blood">Blood group</Label>
                <Select
                  value={form.bloodGroup}
                  onValueChange={(v) => update('bloodGroup', v)}
                >
                  <SelectTrigger id="f-blood">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mode === 'edit' && (
                <div className="space-y-1.5">
                  <Label htmlFor="f-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => update('status', v as PatientFormData['status'])}
                  >
                    <SelectTrigger id="f-status">
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
                <Label htmlFor="f-phone">Phone</Label>
                <Input
                  id="f-phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="+1 555 0100"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-email">Email</Label>
                <Input
                  id="f-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-address">Address</Label>
                <Input
                  id="f-address"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Street, city, state"
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</h3>
            <div className="space-y-1.5">
              <Label htmlFor="f-notes">Medical notes / allergies / conditions</Label>
              <Textarea
                id="f-notes"
                rows={4}
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="e.g. Allergic to penicillin, diabetic, etc."
              />
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
              {mode === 'add' ? 'Add patient' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function toDateInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
