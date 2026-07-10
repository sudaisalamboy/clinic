'use client'

import { useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
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
import { calculateAge } from './format'

interface Props {
  onCreated?: (id: string, name: string) => void
  /** When true, the dialog stays open after creating (useful for chained entry) */
  keepOpen?: boolean
}

export function AddPatientDialog({ onCreated, keepOpen }: Props) {
  const { open, close } = useQuickActions()
  const isOpen = open === 'add-patient'
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(''); setDateOfBirth(''); setGender(''); setBloodGroup(''); setPhone('')
      setEmail(''); setAddress(''); setNotes('')
      setError(null)
    }
  }, [isOpen])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
          bloodGroup: bloodGroup || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add patient')
      toast({ title: 'Patient added', description: data.patient.name })
      if (onCreated) onCreated(data.patient.id, data.patient.name)
      if (!keepOpen) close()
      else {
        setName(''); setDateOfBirth(''); setGender(''); setBloodGroup(''); setPhone('')
        setEmail(''); setAddress(''); setNotes('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add patient')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add patient
          </DialogTitle>
          <DialogDescription>
            Register a new patient record. You can book appointments or generate bills for them afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="p-name">Name *</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-dob">Date of birth</Label>
              <Input id="p-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              {dateOfBirth && (
                <p className="text-xs text-muted-foreground">
                  Age: <span className="text-foreground font-medium">{calculateAge(dateOfBirth) != null ? `${calculateAge(dateOfBirth)}y` : 'invalid'}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-gender">Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as 'male' | 'female' | 'other')}>
                <SelectTrigger id="p-gender">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="p-blood">Blood group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger id="p-blood">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">Phone</Label>
              <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="p-address">Address</Label>
              <Input id="p-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="p-notes">Notes</Label>
              <Textarea id="p-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, conditions, etc." />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add patient
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
