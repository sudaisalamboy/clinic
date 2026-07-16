'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2, Pencil, Plus, Search, Trash2, ArrowLeft, Phone, Mail, MapPin,
  Calendar, DollarSign, User, Stethoscope,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { fmtCurrency, fmtDate, toDateInput } from './utils'
import { DatePicker } from './date-picker'

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

interface Appointment {
  id: string
  patientName: string
  mobile?: string | null
  date: string
  status: string
  fee: number
  type: string
}

const empty: Partial<Staff> = {
  name: '', gender: '', mobile: '', email: '', address: '', photo: '',
  role: 'Doctor', department: '', salary: 0,
  joiningDate: new Date().toISOString(), status: 'Active',
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
  const [profileStaff, setProfileStaff] = useState<Staff | null>(null)
  const [profileAppointments, setProfileAppointments] = useState<Appointment[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
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

  const openProfile = async (s: Staff) => {
    setProfileStaff(s)
    setProfileLoading(true)
    try {
      const res = await fetch(`/api/appointments?staffId=${s.id}&limit=20`)
      const data = await res.json()
      setProfileAppointments(data.appointments || data || [])
    } catch {
      setProfileAppointments([])
    } finally {
      setProfileLoading(false)
    }
  }

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

  // ---- Profile View ----
  if (profileStaff) {
    const s = profileStaff
    const initials = s.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    return (
      <div className="space-y-4 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => setProfileStaff(null)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Staff List
        </Button>

        {/* Profile header card */}
        <Card className="overflow-hidden">
          <div className="h-24" style={{ background: `linear-gradient(135deg, #10b981 0%, #0d9488 100%)` }} />
          <CardContent className="p-6 -mt-12">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 border-4 border-background rounded-full shrink-0">
                {s.photo ? (
                  <img src={s.photo} alt={s.name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <AvatarFallback className="h-full w-full rounded-full bg-emerald-100 text-emerald-700 text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{s.name}</h2>
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${roleColors[s.role] || roleColors.Staff}`}>
                    {s.role}
                  </span>
                  <Badge variant={s.status === 'Active' ? 'default' : 'secondary'}>{s.status}</Badge>
                </div>
                {s.department && (
                  <p className="text-sm text-muted-foreground mt-0.5">{s.department}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => { openEdit(s); setProfileStaff(null) }} className="gap-1.5 mb-2">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="Mobile" value={s.mobile || '—'} />
              <DetailRow icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email" value={s.email || '—'} />
              <DetailRow icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="Address" value={s.address || '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Employment Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="Gender" value={s.gender || '—'} />
              <DetailRow icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} label="Salary" value={fmtCurrency(s.salary, currency)} />
              <DetailRow icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Joining Date" value={fmtDate(s.joiningDate)} />
            </CardContent>
          </Card>
        </div>

        {/* Recent appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-emerald-600" />
              Recent Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : profileAppointments.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">No appointments yet.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="p-2">Patient</TableHead>
                      <TableHead className="p-2">Date</TableHead>
                      <TableHead className="p-2">Type</TableHead>
                      <TableHead className="p-2">Fee</TableHead>
                      <TableHead className="p-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profileAppointments.map((a) => (
                      <TableRow key={a.id} className="hover:bg-muted/50">
                        <TableCell className="p-2 font-medium">{a.patientName}</TableCell>
                        <TableCell className="p-2 text-sm">{fmtDate(a.date)}</TableCell>
                        <TableCell className="p-2 text-sm">{a.type}</TableCell>
                        <TableCell className="p-2 text-sm">{fmtCurrency(a.fee, currency)}</TableCell>
                        <TableCell className="p-2">
                          <Badge variant={a.status === 'Completed' ? 'default' : a.status === 'Cancelled' ? 'destructive' : 'secondary'}>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- List View ----
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
                      className="hover:bg-muted/50 border-b transition-colors cursor-pointer"
                      onClick={() => openProfile(s)}
                    >
                      <TableCell className="font-medium p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {s.photo ? (
                              <img src={s.photo} alt="" className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <AvatarFallback className="bg-muted text-[10px]">
                                {s.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span className="text-emerald-600 hover:underline">{s.name}</span>
                        </div>
                      </TableCell>
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
                      <TableCell className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
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
              <DatePicker
                value={toDateInput(form.joiningDate)}
                onChange={(v) => setForm({ ...form, joiningDate: new Date(v).toISOString() })}
                withTime={false}
                placeholder="Select date"
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

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}
