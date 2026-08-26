'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2, Pencil, Plus, Search, Trash2, ArrowLeft, Phone, Mail, MapPin,
  Calendar, DollarSign, User, Stethoscope, IndianRupee,
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { apiFetch, apiFetchList } from '@/lib/api-client'
import { fmtCurrency, fmtDate, toDateInput } from './utils'
import { DatePicker } from './date-picker'
import { EmptyState } from './empty-state'
import { LoadingDots } from './skeletons'
import { ListTruncatedNotice } from './list-truncated-notice'

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

interface SalaryPayment {
  id: string
  staffId: string
  amount: number
  month: string
  method: string
  note?: string | null
  paidAt: string
  staff?: { id: string; name: string; role: string } | null
}

/** Current salary period as "YYYY-MM" (used to prefill the pay dialog). */
function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
  const [total, setTotal] = useState(0)
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
  // ---- Salary payroll state ----
  const [salaryStaff, setSalaryStaff] = useState<Staff | null>(null)
  const [salaryForm, setSalaryForm] = useState<{ month: string; amount: number; method: string; note: string }>({
    month: currentMonth(), amount: 0, method: 'Cash', note: '',
  })
  const [salaryHistory, setSalaryHistory] = useState<SalaryPayment[]>([])
  const [salarySaving, setSalarySaving] = useState(false)
  const [salaryLoading, setSalaryLoading] = useState(false)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: count } = await apiFetchList<Staff>(`/api/staff?q=${encodeURIComponent(q)}&role=${role}`)
      setItems(data)
      setTotal(count)
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
      const data = await apiFetch<Appointment[]>(`/api/appointments?staffId=${s.id}&limit=20`)
      setProfileAppointments(Array.isArray(data) ? data : [])
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
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
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
      await apiFetch(`/api/staff/${deleteId}`, { method: 'DELETE' })
      toast({ title: 'Staff deleted' })
      setDeleteId(null)
      load()
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
  }

  // ---- Salary payroll ----
  const openSalary = async (s: Staff) => {
    setSalaryStaff(s)
    setSalaryForm({
      month: currentMonth(),
      amount: s.salary,
      method: 'Cash',
      note: '',
    })
    setSalaryHistory([])
    setSalaryLoading(true)
    try {
      const data = await apiFetch<SalaryPayment[]>(`/api/salary-payments?staffId=${s.id}`)
      setSalaryHistory(Array.isArray(data) ? data : [])
    } catch {
      setSalaryHistory([])
    } finally {
      setSalaryLoading(false)
    }
  }

  const loadSalaryHistory = async (staffId: string) => {
    try {
      const data = await apiFetch<SalaryPayment[]>(`/api/salary-payments?staffId=${staffId}`)
      setSalaryHistory(Array.isArray(data) ? data : [])
    } catch {
      setSalaryHistory([])
    }
  }

  const paySalary = async () => {
    if (!salaryStaff) return
    if (!/^\d{4}-\d{2}$/.test(salaryForm.month)) {
      toast({ title: 'Invalid month', description: 'Use YYYY-MM format, e.g. 2026-01', variant: 'destructive' })
      return
    }
    if (salaryForm.amount < 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' })
      return
    }
    setSalarySaving(true)
    try {
      await apiFetch('/api/salary-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: salaryStaff.id,
          amount: salaryForm.amount,
          month: salaryForm.month,
          method: salaryForm.method,
          note: salaryForm.note || undefined,
        }),
      })
      toast({
        title: 'Salary paid',
        description: `${salaryStaff.name} — ${salaryForm.month}`,
      })
      // Advance the month prefill so consecutive months are easy.
      const [y, m] = salaryForm.month.split('-').map(Number)
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
      setSalaryForm((f) => ({ ...f, month: next, note: '' }))
      loadSalaryHistory(salaryStaff.id)
    } catch (err) {
      toast({ title: 'Payment failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSalarySaving(false)
    }
  }

  const removePayment = async () => {
    if (!deletePaymentId || !salaryStaff) return
    try {
      await apiFetch(`/api/salary-payments/${deletePaymentId}`, { method: 'DELETE' })
      toast({ title: 'Salary entry removed' })
      setDeletePaymentId(null)
      loadSalaryHistory(salaryStaff.id)
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
        <Card className="overflow-hidden hover-lift">
          <div className="h-24" style={{ background: `linear-gradient(135deg, #10b981 0%, #0d9488 100%)` }} />
          <CardContent className="p-6 -mt-12">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 border-4 border-background rounded-full shrink-0">
                {s.photo ? (
                  // Runtime-uploaded photo (data-URL / arbitrary remote URL) —
                  // see app-shell.tsx note on why next/image is not used.
                  // eslint-disable-next-line @next/next/no-img-element
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
              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { openEdit(s); setProfileStaff(null) }}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => openSalary(s)}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  <IndianRupee className="h-3.5 w-3.5" /> Pay Salary
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover-lift">
            <CardHeader><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="Mobile" value={s.mobile || '—'} />
              <DetailRow icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email" value={s.email || '—'} />
              <DetailRow icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="Address" value={s.address || '—'} />
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader><CardTitle className="text-sm">Employment Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="Gender" value={s.gender || '—'} />
              <DetailRow icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} label="Salary" value={fmtCurrency(s.salary, currency)} />
              <DetailRow icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Joining Date" value={fmtDate(s.joiningDate)} />
            </CardContent>
          </Card>
        </div>

        {/* Recent appointments */}
        <Card className="hover-lift">
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
              <EmptyState title="No appointments yet" description="This staff member has no appointments" />
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
                      <TableRow key={a.id} className="hover:bg-muted/50 row-hover">
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
                <ListTruncatedNotice shown={items.length} total={total} />
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
      <Card className="hover-lift">
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
            <LoadingDots text="Loading staff" />
          ) : items.length === 0 ? (
            <EmptyState title="No staff yet" description="Add doctors, nurses, or staff" />
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
                      className="hover:bg-muted/50 border-b transition-colors cursor-pointer row-hover"
                      onClick={() => openProfile(s)}
                    >
                      <TableCell className="font-medium p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {s.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
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
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Pay salary to ${s.name}`}
                          title="Pay Salary"
                          onClick={() => openSalary(s)}
                        >
                          <IndianRupee className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => setDeleteId(s.id)}>
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
            <DialogDescription className="sr-only">Add or update a staff member&#39;s details.</DialogDescription>
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

      {/* ---- Salary payment dialog ---- */}
      <Dialog open={!!salaryStaff} onOpenChange={(o) => !o && setSalaryStaff(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
              Pay Salary — {salaryStaff?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Record a monthly salary payment and review the payment history for this staff member.
            </DialogDescription>
          </DialogHeader>

          {salaryStaff && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {salaryStaff.role}{salaryStaff.department ? ` · ${salaryStaff.department}` : ''}
                </span>
                <span className="font-medium">Monthly salary: {fmtCurrency(salaryStaff.salary, currency)}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary-month">Month (YYYY-MM) *</Label>
                  <Input
                    id="salary-month"
                    value={salaryForm.month}
                    onChange={(e) => setSalaryForm({ ...salaryForm, month: e.target.value })}
                    placeholder="2026-01"
                    maxLength={7}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-amount">Amount ({currency}) *</Label>
                  <Input
                    id="salary-amount"
                    type="number"
                    min={0}
                    value={salaryForm.amount}
                    onChange={(e) => setSalaryForm({ ...salaryForm, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select
                    value={salaryForm.method}
                    onValueChange={(v) => setSalaryForm({ ...salaryForm, method: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-note">Note</Label>
                  <Input
                    id="salary-note"
                    value={salaryForm.note}
                    onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
                    placeholder="Optional note"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSalaryStaff(null)}>Close</Button>
                <Button onClick={paySalary} disabled={salarySaving} className="bg-emerald-600 hover:bg-emerald-700">
                  {salarySaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Pay {fmtCurrency(salaryForm.amount, currency)}
                </Button>
              </DialogFooter>

              {/* Payment history */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Payment History</h4>
                  <span className="text-xs text-muted-foreground">
                    Total paid: {fmtCurrency(
                      salaryHistory.reduce((sum, p) => sum + (p.amount || 0), 0),
                      currency,
                    )}
                  </span>
                </div>
                {salaryLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : salaryHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No salary payments recorded yet.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="p-2">Month</TableHead>
                          <TableHead className="p-2">Amount</TableHead>
                          <TableHead className="p-2">Method</TableHead>
                          <TableHead className="p-2">Paid On</TableHead>
                          <TableHead className="p-2 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryHistory.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="p-2 font-medium">{p.month}</TableCell>
                            <TableCell className="p-2">{fmtCurrency(p.amount, currency)}</TableCell>
                            <TableCell className="p-2 text-sm">{p.method}</TableCell>
                            <TableCell className="p-2 text-sm">{fmtDate(p.paidAt)}</TableCell>
                            <TableCell className="p-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete salary entry ${p.month}`}
                                onClick={() => setDeletePaymentId(p.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Salary entry delete confirm */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={(o) => !o && setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this salary entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The entry is removed from payroll history. The action is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removePayment} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
