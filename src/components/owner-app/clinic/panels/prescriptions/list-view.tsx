'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  FileText,
  Eye,
  Trash2,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  Pill,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { formatDateTime, formatDate, calculateAge } from '../../format'
import type { PrescriptionListItem } from './prescription-helpers'

interface Props {
  onOpenPrescription: (id: string) => void
  onCreate: () => void
  refreshKey: number
}

export function AllPrescriptionsView({ onOpenPrescription, onCreate, refreshKey }: Props) {
  const { toast } = useToast()
  const [prescriptions, setPrescriptions] = useState<PrescriptionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PrescriptionListItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (query) params.set('q', query)
      const res = await fetch(`/api/prescriptions?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPrescriptions(data.prescriptions)
    } catch {
      toast({ title: 'Failed to load prescriptions', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [query, toast])

  useEffect(() => {
    const id = setTimeout(() => { void load() }, 300)
    return () => clearTimeout(id)
  }, [query, load])

  useEffect(() => { void load() }, [load, refreshKey])

  async function deletePrescription(p: PrescriptionListItem) {
    setDeleteTarget(null)
    try {
      await fetch(`/api/prescriptions/${p.id}`, { method: 'DELETE' })
      toast({ title: 'Prescription deleted' })
      void load()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Prescriptions
            <Badge variant="secondary" className="font-normal">{prescriptions.length}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search RX #, patient, doctor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[240px]"
              />
            </div>
            <Button size="sm" onClick={onCreate}>
              <FileText className="h-3.5 w-3.5" />
              Create
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">{query ? 'No prescriptions match your search.' : 'No prescriptions yet.'}</p>
            {!query && (
              <Button size="sm" variant="outline" onClick={onCreate}>
                <FileText className="h-3.5 w-3.5" />
                Create your first prescription
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {prescriptions.map((p) => {
                  const isOpen = expanded === p.id
                  const nextVisit = p.nextVisitDate ? new Date(p.nextVisitDate) : null
                  const isUpcoming = nextVisit && nextVisit.getTime() > Date.now()
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-lg border bg-card"
                    >
                      <button
                        onClick={() => setExpanded(isOpen ? null : p.id)}
                        className="w-full text-left p-3 hover:bg-accent/20 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              <span className="font-mono text-xs text-muted-foreground">{p.prescriptionNumber}</span>
                              <span className="font-medium text-sm">{p.patient.name}</span>
                              {p.patient.dateOfBirth && (
                                <span className="text-xs text-muted-foreground">{calculateAge(p.patient.dateOfBirth)}y</span>
                              )}
                              {isUpcoming && (
                                <Badge variant="outline" className="text-xs font-normal border-violet-500/40 text-violet-600 dark:text-violet-400">
                                  <CalendarClock className="h-3 w-3" />
                                  Follow-up {formatDate(p.nextVisitDate!)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-6">
                              {formatDateTime(p.createdAt)}
                              {p.doctor ? ` · Dr. ${p.doctor.name}` : ''}
                              {p.medicalRecord.diagnosis ? ` · ${p.medicalRecord.diagnosis}` : ''}
                              {' · '}{p.medicines.length} medicine{p.medicines.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); onOpenPrescription(p.id) }}
                              title="View / Print"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t bg-muted/20"
                          >
                            <div className="p-3 space-y-3">
                              {/* Medicines preview */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                  <Pill className="h-3 w-3" /> Medicines
                                </p>
                                <div className="space-y-1">
                                  {p.medicines.map((m, i) => (
                                    <div key={i} className="text-xs flex items-center gap-2 px-2 py-1 rounded border bg-card">
                                      <span className="font-medium">{m.name}</span>
                                      {m.dosage && <span className="text-muted-foreground">· {m.dosage}</span>}
                                      {m.frequency && <span className="text-muted-foreground">· {m.frequency}</span>}
                                      {m.duration && <span className="text-muted-foreground">· {m.duration}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {p.advice && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Advice</p>
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{p.advice}</p>
                                </div>
                              )}
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => onOpenPrescription(p.id)}>
                                  <Eye className="h-3.5 w-3.5" />
                                  View / Print
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(p)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prescription {deleteTarget?.prescriptionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the prescription. The medical record will be kept. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deletePrescription(deleteTarget)}
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
