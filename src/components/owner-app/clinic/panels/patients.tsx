'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  Users,
  Pencil,
  Trash2,
  Check,
  X,
  Phone,
  Mail,
  CalendarPlus,
  ReceiptText,
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
import { Textarea } from '@/components/ui/textarea'
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
import { formatDate, formatRelative } from '../format'

interface Patient {
  id: string
  name: string
  age: number | null
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  createdAt: string
  _count: { appointments: number; bills: number }
}

export function PatientsPanel() {
  const { openAction } = useQuickActions()
  const { toast } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Patient>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPatients(data.patients)
    } catch {
      toast({ title: 'Failed to load patients', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [query, toast])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(p: Patient) {
    setEditingId(p.id)
    setDraft({
      name: p.name,
      age: p.age,
      gender: p.gender,
      phone: p.phone,
      email: p.email,
      address: p.address,
      notes: p.notes,
    })
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          age: draft.age === null ? null : draft.age,
          gender: draft.gender || null,
          phone: draft.phone || null,
          email: draft.email || null,
          address: draft.address || null,
          notes: draft.notes || null,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      const data = await res.json()
      setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.patient, _count: p._count } : p)))
      setEditingId(null)
      toast({ title: 'Patient updated' })
    } catch {
      toast({ title: 'Failed to update patient', variant: 'destructive' })
    }
  }

  async function deletePatient(id: string) {
    const prev = patients
    setPatients((p) => p.filter((x) => x.id !== id))
    setDeleteId(null)
    try {
      await fetch(`/api/patients/${id}`, { method: 'DELETE' })
      toast({ title: 'Patient deleted' })
    } catch {
      setPatients(prev)
      toast({ title: 'Failed to delete patient', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Patients
            <Badge variant="secondary" className="font-normal">{patients.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[240px]"
              />
            </div>
            <Button onClick={() => openAction('add-patient')} size="sm">
              Add patient
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">{query ? 'No patients match your search.' : 'No patients yet.'}</p>
            {!query && (
              <Button size="sm" variant="outline" onClick={() => openAction('add-patient')}>
                Add your first patient
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {patients.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-lg border bg-card p-3"
                  >
                    {editingId === p.id ? (
                      <EditForm
                        draft={draft}
                        onChange={setDraft}
                        onCancel={() => setEditingId(null)}
                        onSave={() => saveEdit(p.id)}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm">{p.name}</h3>
                            {p.age != null && (
                              <Badge variant="outline" className="text-xs font-normal">{p.age}y</Badge>
                            )}
                            {p.gender && (
                              <Badge variant="outline" className="text-xs font-normal capitalize">{p.gender}</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatRelative(p.createdAt)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                            {p.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {p.phone}
                              </span>
                            )}
                            {p.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {p.email}
                              </span>
                            )}
                          </div>
                          {p.address && (
                            <p className="text-xs text-muted-foreground mt-1">{p.address}</p>
                          )}
                          {p.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.notes}</p>
                          )}
                          <div className="flex gap-3 mt-2 text-xs">
                            <span className="text-muted-foreground">
                              <CalendarPlus className="inline h-3 w-3 mr-1" />
                              {p._count.appointments} appointment{p._count.appointments === 1 ? '' : 's'}
                            </span>
                            <span className="text-muted-foreground">
                              <ReceiptText className="inline h-3 w-3 mr-1" />
                              {p._count.bills} bill{p._count.bills === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(p.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete patient?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all their appointments and bills. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deletePatient(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function EditForm({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Partial<Patient>
  onChange: (d: Partial<Patient>) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={draft.name ?? ''}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Age</Label>
          <Input
            type="number"
            value={draft.age ?? ''}
            onChange={(e) => onChange({ ...draft, age: e.target.value ? parseInt(e.target.value, 10) : null })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Gender</Label>
          <Select
            value={draft.gender ?? ''}
            onValueChange={(v) => onChange({ ...draft, gender: v })}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={draft.phone ?? ''} onChange={(e) => onChange({ ...draft, phone: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={draft.email ?? ''} onChange={(e) => onChange({ ...draft, email: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Address</Label>
          <Input value={draft.address ?? ''} onChange={(e) => onChange({ ...draft, address: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={draft.notes ?? ''} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave}>
          <Check className="h-3.5 w-3.5" /> Save
        </Button>
      </div>
    </div>
  )
}
