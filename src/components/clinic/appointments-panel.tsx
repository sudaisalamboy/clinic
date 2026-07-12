'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CalendarCheck, CheckCircle2, Loader2, Pencil, Plus, Search, Trash2, XCircle } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { fmtCurrency, fmtDateTime, toDateTimeInput } from './utils'
import { DatePicker } from './date-picker'

interface Staff { id: string; name: string; role: string }
interface Fee { id: string; name: string; fee: number }
interface Appointment {
  id: string
  patientName: string
  mobile?: string | null
  staffId?: string | null
  staff?: Staff | null
  consultationFeeId?: string | null
  consultationFee?: Fee | null
  date: string | Date
  type: string
  fee: number
  status: string
  notes?: string | null
}

const statusColors: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-800',
  'No Show': 'bg-slate-200 text-slate-800',
}

export function AppointmentsPanel({ currency = '₹' }: { currency?: string }) {
  const [items, setItems] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Staff[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [form, setForm] = useState<any>({
    patientName: '',
    mobile: '',
    staffId: '',
    consultationFeeId: '',
    date: new Date().toISOString(),
    type: 'Walk-in',
    fee: 0,
    status: 'Pending',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (date) params.set('date', date)
      if (status) params.set('status', status)
      const res = await fetch(`/api/appointments?${params.toString()}`)
      const data = await res.json()
      setItems(data)
    } catch {
      toast({ title: 'Failed to load appointments', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [q, date, status, toast])

  useEffect(() => {
    fetch('/api/staff?role=Doctor').then((r) => r.json()).then(setDoctors).catch(() => {})
    fetch('/api/consultation-fees').then((r) => r.json()).then(setFees).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({
      patientName: '',
      mobile: '',
      staffId: '',
      consultationFeeId: fees[0]?.id || '',
      date: new Date().toISOString(),
      type: 'Walk-in',
      fee: fees[0]?.fee || 0,
      status: 'Pending',
      notes: '',
    })
    setOpen(true)
  }

  const openEdit = (a: Appointment) => {
    setEditing(a)
    setForm({
      ...a,
      staffId: a.staffId || '',
      consultationFeeId: a.consultationFeeId || '',
      date: a.date,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.patientName) {
      toast({ title: 'Patient name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/appointments/${editing.id}` : '/api/appointments'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Save failed')
      toast({ title: editing ? 'Appointment updated' : 'Appointment created' })
      setOpen(false)
      load()
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const setStatusAndSave = async (a: Appointment, newStatus: string) => {
    try {
      const res = await fetch(`/api/appointments/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      toast({ title: `Marked ${newStatus}` })
      load()
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' })
    }
  }

  const remove = async () => {
    if (!deleteId) return
    try {
      await fetch(`/api/appointments/${deleteId}`, { method: 'DELETE' })
      toast({ title: 'Appointment deleted' })
      setDeleteId(null)
      load()
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle>Appointments</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="pl-8 w-48"
              />
            </div>
            <DatePicker
              value={date}
              onChange={(v) => setDate(v.slice(0, 10))}
              withTime={false}
              placeholder="Filter date"
              className="w-40"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="No Show">No Show</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No appointments found.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-muted/50 border-b transition-colors"
                    >
                      <TableCell className="font-medium p-2">{a.patientName}</TableCell>
                      <TableCell className="p-2">{a.mobile || '—'}</TableCell>
                      <TableCell className="p-2">{a.staff?.name || '—'}</TableCell>
                      <TableCell className="p-2">{fmtDateTime(a.date)}</TableCell>
                      <TableCell className="p-2">{a.type}</TableCell>
                      <TableCell className="p-2">{fmtCurrency(a.fee, currency)}</TableCell>
                      <TableCell className="p-2">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusColors[a.status] || statusColors.Pending}`}>
                          {a.status}
                        </span>
                      </TableCell>
                      <TableCell className="p-2 text-right whitespace-nowrap">
                        {a.status === 'Pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Complete"
                              onClick={() => setStatusAndSave(a, 'Completed')}
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="No Show"
                              onClick={() => setStatusAndSave(a, 'No Show')}
                            >
                              <CalendarCheck className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancel"
                              onClick={() => setStatusAndSave(a, 'Cancelled')}
                            >
                              <XCircle className="h-4 w-4 text-rose-600" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Patient Name *</Label>
              <Input value={form.patientName || ''} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={form.mobile || ''} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select
                value={form.staffId || 'none'}
                onValueChange={(v) => setForm({ ...form, staffId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Consultation Fee</Label>
              <Select
                value={form.consultationFeeId || 'none'}
                onValueChange={(v) => {
                  const f = fees.find((x) => x.id === v)
                  setForm({ ...form, consultationFeeId: v === 'none' ? '' : v, fee: f?.fee || 0 })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select fee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {fees.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({currency}{f.fee})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <DatePicker
                value={toDateTimeInput(form.date)}
                onChange={(v) => setForm({ ...form, date: new Date(v).toISOString() })}
                withTime={true}
                placeholder="Select date & time"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fee ({currency})</Label>
              <Input
                type="number"
                value={form.fee || 0}
                onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="No Show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
