'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
import { fmtCurrency, fmtDate, toDateInput } from './utils'

interface Staff {
  id: string
  name: string
  gender?: string | null
  mobile?: string | null
  email?: string | null
  address?: string | null
  photo?: string | null
  role: string
  department?: string | null
  salary: number
  joiningDate: string | Date
  status: string
}

const empty: Partial<Staff> = {
  name: '',
  gender: '',
  mobile: '',
  email: '',
  address: '',
  photo: '',
  role: 'Doctor',
  department: '',
  salary: 0,
  joiningDate: new Date().toISOString(),
  status: 'Active',
}

const roleColors: Record<string, string> = {
  Doctor: 'bg-emerald-100 text-emerald-800',
  Nurse: 'bg-sky-100 text-sky-800',
  Receptionist: 'bg-amber-100 text-amber-800',
  Staff: 'bg-slate-100 text-slate-800',
}

export function StaffPanel({ currency = '₹' }: { currency?: string }) {
  const [items, setItems] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form, setForm] = useState<Partial<Staff>>(empty)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff?q=${encodeURIComponent(q)}&role=${role}`)
      const data = await res.json()
      setItems(data)
    } catch {
      toast({ title: 'Failed to load staff', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [q, role, toast])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty, joiningDate: new Date().toISOString() })
    setOpen(true)
  }
  const openEdit = (s: Staff) => {
    setEditing(s)
    setForm({ ...s })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/staff/${editing.id}` : '/api/staff'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Save failed')
      toast({ title: editing ? 'Staff updated' : 'Staff created' })
      setOpen(false)
      load()
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteId) return
    try {
      await fetch(`/api/staff/${deleteId}`, { method: 'DELETE' })
      toast({ title: 'Staff deleted' })
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
          <CardTitle>Staff</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search staff..."
                className="pl-8 w-56"
              />
            </div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Doctor">Doctor</SelectItem>
                <SelectItem value="Nurse">Nurse</SelectItem>
                <SelectItem value="Receptionist">Receptionist</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> Add Staff
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No staff yet.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s, i) => (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-muted/50 border-b transition-colors"
                    >
                      <TableCell className="font-medium p-2">{s.name}</TableCell>
                      <TableCell className="p-2">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${roleColors[s.role] || roleColors.Staff}`}>
                          {s.role}
                        </span>
                      </TableCell>
                      <TableCell className="p-2">{s.department || '—'}</TableCell>
                      <TableCell className="p-2">{s.mobile || '—'}</TableCell>
                      <TableCell className="p-2">{fmtCurrency(s.salary, currency)}</TableCell>
                      <TableCell className="p-2">{fmtDate(s.joiningDate)}</TableCell>
                      <TableCell className="p-2">
                        <Badge variant={s.status === 'Active' ? 'default' : 'secondary'}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.gender || ''} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={form.mobile || ''} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role || 'Staff'} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Doctor">Doctor</SelectItem>
                  <SelectItem value="Nurse">Nurse</SelectItem>
                  <SelectItem value="Receptionist">Receptionist</SelectItem>
                  <SelectItem value="Staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Salary ({currency})</Label>
              <Input
                type="number"
                value={form.salary ?? 0}
                onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Joining Date</Label>
              <Input
                type="date"
                value={toDateInput(form.joiningDate)}
                onChange={(e) => setForm({ ...form, joiningDate: new Date(e.target.value).toISOString() })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status || 'Active'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Photo URL</Label>
              <Input value={form.photo || ''} onChange={(e) => setForm({ ...form, photo: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
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
            <AlertDialogTitle>Delete this staff member?</AlertDialogTitle>
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
