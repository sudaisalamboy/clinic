'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Loader2,
  Stethoscope,
  Eye,
  Pencil,
  Trash2,
  UserPlus,
  Phone,
  Mail,
  Building2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatCurrency } from '../../format'
import { isWorkingToday } from './schedule-helpers'

export interface DoctorSummary {
  id: string
  doctorCode: string
  name: string
  specialization: string | null
  phone: string | null
  email: string | null
  consultationFee: number
  status: string
  department: { id: string; name: string } | null
  _count: { appointments: number }
}

interface Department { id: string; name: string }

interface Props {
  onOpenDoctor: (id: string) => void
  onEditDoctor: (id: string) => void
  onAddDoctor: () => void
  refreshKey: number
}

export function DoctorListView({ onOpenDoctor, onEditDoctor, onAddDoctor, refreshKey }: Props) {
  const { toast } = useToast()
  const [doctors, setDoctors] = useState<DoctorSummary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [deptId, setDeptId] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<DoctorSummary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (status !== 'all') params.set('status', status)
      if (deptId !== 'all') params.set('departmentId', deptId)
      const res = await fetch(`/api/doctors?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setDoctors(data.doctors)
    } catch {
      toast({ title: 'Failed to load doctors', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [query, status, deptId, toast])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) return
      const data = await res.json()
      setDepartments(data.departments)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void loadDepartments() }, [loadDepartments])

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => { void load() }, 300)
    return () => clearTimeout(id)
  }, [query, status, deptId, load])

  useEffect(() => { void load() }, [load, refreshKey])

  async function toggleStatus(d: DoctorSummary) {
    const next = d.status === 'Active' ? 'Inactive' : 'Active'
    setDoctors((prev) => prev.map((x) => x.id === d.id ? { ...x, status: next } : x))
    try {
      const res = await fetch(`/api/doctors/${d.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({ title: `${d.name} is now ${next}` })
    } catch {
      setDoctors((prev) => prev.map((x) => x.id === d.id ? { ...x, status: d.status } : x))
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  async function softDelete(d: DoctorSummary) {
    setDeleteTarget(null)
    try {
      const res = await fetch(`/api/doctors/${d.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast({ title: `${d.name} deactivated` })
      void load()
    } catch {
      toast({ title: 'Failed to deactivate', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Doctors
            <Badge variant="secondary" className="font-normal">{doctors.length}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, code, phone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[220px]"
              />
            </div>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={onAddDoctor} size="sm">
              <UserPlus className="h-3.5 w-3.5" />
              Add doctor
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">
              {query || status !== 'all' || deptId !== 'all'
                ? 'No doctors match your filters.'
                : 'No doctors yet.'}
            </p>
            {!query && status === 'all' && deptId === 'all' && (
              <Button size="sm" variant="outline" onClick={onAddDoctor}>
                <UserPlus className="h-3.5 w-3.5" />
                Add your first doctor
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="font-medium px-2 py-2">Code</th>
                  <th className="font-medium px-2 py-2">Name</th>
                  <th className="font-medium px-2 py-2 hidden md:table-cell">Specialization</th>
                  <th className="font-medium px-2 py-2 hidden lg:table-cell">Department</th>
                  <th className="font-medium px-2 py-2 hidden sm:table-cell">Fee</th>
                  <th className="font-medium px-2 py-2 hidden xl:table-cell">Contact</th>
                  <th className="font-medium px-2 py-2">Status</th>
                  <th className="font-medium px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((d, i) => {
                  const inactive = d.status === 'Inactive'
                  return (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.2) }}
                      className="border-b last:border-0 hover:bg-accent/30 transition cursor-pointer group"
                      onClick={() => onOpenDoctor(d.id)}
                    >
                      <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                        {d.doctorCode}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden">
                          {d.specialization ?? '—'} · {d.department?.name ?? '—'}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground hidden md:table-cell">
                        {d.specialization ?? '—'}
                      </td>
                      <td className="px-2 py-2 hidden lg:table-cell">
                        {d.department ? (
                          <Badge variant="outline" className="text-xs font-normal gap-1">
                            <Building2 className="h-3 w-3" />
                            {d.department.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground hidden sm:table-cell tabular-nums">
                        {formatCurrency(d.consultationFee)}
                      </td>
                      <td className="px-2 py-2 hidden xl:table-cell">
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {d.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {d.phone}
                            </span>
                          )}
                          {d.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {d.email}
                            </span>
                          )}
                          {!d.phone && !d.email && <span>—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleStatus(d)}
                          className="inline-flex items-center gap-1.5"
                          title={`Click to set ${inactive ? 'Active' : 'Inactive'}`}
                        >
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              inactive ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                          />
                          <Badge
                            variant="outline"
                            className={`text-xs font-normal cursor-pointer ${
                              inactive
                                ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5'
                                : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                            }`}
                          >
                            {d.status}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onOpenDoctor(d.id)} title="View profile">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditDoctor(d.id)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:text-rose-700" onClick={() => setDeleteTarget(d)} title="Deactivate">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a soft delete — the doctor's status will change to <strong>Inactive</strong>.
              Their schedule and past appointments are preserved. You can restore them from their profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && softDelete(deleteTarget)}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
