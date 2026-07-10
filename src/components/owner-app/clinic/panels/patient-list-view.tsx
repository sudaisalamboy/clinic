'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  UserPlus,
  Phone,
  Mail,
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
import { useQuickActions } from '../quick-actions-context'
import { calculateAge, formatRelative } from '../format'

export interface PatientSummary {
  id: string
  patientCode: string
  name: string
  dateOfBirth: string | null
  gender: string | null
  phone: string | null
  email: string | null
  status: string
  createdAt: string
  _count: { appointments: number; bills: number }
}

interface Props {
  onOpenPatient: (id: string) => void
  onEditPatient: (id: string) => void
  onAddPatient: () => void
  refreshKey: number
}

export function PatientListView({ onOpenPatient, onEditPatient, onAddPatient, refreshKey }: Props) {
  const { toast } = useToast()
  const { openAction } = useQuickActions()
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [deleteTarget, setDeleteTarget] = useState<PatientSummary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (status !== 'all') params.set('status', status)
      params.set('page', String(page))
      params.set('limit', '10')
      const res = await fetch(`/api/patients?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPatients(data.patients)
      setPagination(data.pagination)
    } catch {
      toast({ title: 'Failed to load patients', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [query, status, page, toast])

  // Debounce search — when query changes, reset to page 1 and reload
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  // load() is already memoized on [query, status, page] so this re-fetches
  // whenever any of those change. refreshKey triggers a manual reload.
  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function softDelete(p: PatientSummary) {
    setDeleteTarget(null)
    try {
      const res = await fetch(`/api/patients/${p.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast({
        title: 'Patient deactivated',
        description: `${p.name} is now marked Inactive. You can restore them from their profile.`,
      })
      void load()
    } catch {
      toast({ title: 'Failed to deactivate patient', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Patients
            <Badge variant="secondary" className="font-normal">{pagination.total}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email, code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[260px]"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={onAddPatient} size="sm">
              <UserPlus className="h-3.5 w-3.5" />
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
            <p className="text-sm mb-3">
              {query || status !== 'all'
                ? 'No patients match your filters.'
                : 'No patients yet.'}
            </p>
            {!query && status === 'all' && (
              <Button size="sm" variant="outline" onClick={onAddPatient}>
                <UserPlus className="h-3.5 w-3.5" />
                Add your first patient
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="font-medium px-2 py-2">Code</th>
                    <th className="font-medium px-2 py-2">Name</th>
                    <th className="font-medium px-2 py-2 hidden sm:table-cell">Age</th>
                    <th className="font-medium px-2 py-2 hidden md:table-cell">Gender</th>
                    <th className="font-medium px-2 py-2 hidden lg:table-cell">Contact</th>
                    <th className="font-medium px-2 py-2">Status</th>
                    <th className="font-medium px-2 py-2 hidden xl:table-cell">Added</th>
                    <th className="font-medium px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p, i) => {
                    const age = calculateAge(p.dateOfBirth)
                    const inactive = p.status === 'Inactive'
                    return (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.2) }}
                        className="border-b last:border-0 hover:bg-accent/30 transition cursor-pointer group"
                        onClick={() => onOpenPatient(p.id)}
                      >
                        <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                          {p.patientCode}
                        </td>
                        <td className="px-2 py-2">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {age != null ? `${age}y` : '—'} · {p.gender ?? '—'}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground hidden sm:table-cell">
                          {age != null ? `${age}y` : '—'}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground hidden md:table-cell capitalize">
                          {p.gender ?? '—'}
                        </td>
                        <td className="px-2 py-2 hidden lg:table-cell">
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
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
                            {!p.phone && !p.email && <span>—</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs font-normal ${
                              inactive
                                ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5'
                                : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                            }`}
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground hidden xl:table-cell text-xs">
                          {formatRelative(p.createdAt)}
                        </td>
                        <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onOpenPatient(p.id)}
                              title="View profile"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onEditPatient(p.id)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-600 hover:text-rose-700"
                              onClick={() => setDeleteTarget(p)}
                              title="Deactivate"
                            >
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

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a soft delete — the patient's status will change to <strong>Inactive</strong>.
              Their records (appointments, bills) are preserved. You can restore them from their profile at any time.
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
