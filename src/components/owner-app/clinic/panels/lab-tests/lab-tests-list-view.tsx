'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  Beaker,
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
import { formatCurrency } from '../../format'
import type { LabTest } from './lab-helpers'

interface Props {
  onAdd: () => void
  onEdit: (id: string) => void
  refreshKey: number
}

export function LabTestsListView({ onAdd, onEdit, refreshKey }: Props) {
  const { toast } = useToast()
  const [tests, setTests] = useState<LabTest[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<LabTest | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/lab-tests?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setTests(data.labTests)
    } catch {
      toast({ title: 'Failed to load lab tests', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [query, statusFilter, toast])

  useEffect(() => {
    const id = setTimeout(() => { void load() }, 300)
    return () => clearTimeout(id)
  }, [query, statusFilter, load])

  useEffect(() => { void load() }, [load, refreshKey])

  async function deleteTest(t: LabTest) {
    setDeleteTarget(null)
    try {
      const res = await fetch(`/api/lab-tests/${t.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'delete failed')
      }
      toast({ title: 'Lab test deleted' })
      void load()
    } catch (e) {
      toast({
        title: 'Failed to delete',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  // Group by category
  const categories = new Map<string, LabTest[]>()
  for (const t of tests) {
    const k = t.category ?? 'Uncategorized'
    if (!categories.has(k)) categories.set(k, [])
    categories.get(k)!.push(t)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Lab test catalog
            <Badge variant="secondary" className="font-normal">{tests.length}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[220px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add test
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">{query ? 'No lab tests match your search.' : 'No lab tests yet.'}</p>
            {!query && (
              <Button size="sm" variant="outline" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add your first test
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-4">
              {Array.from(categories.entries()).map(([cat, items]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <Beaker className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h3>
                    <Badge variant="outline" className="text-xs font-normal">{items.length}</Badge>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map((t, i) => (
                      <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.2) }}
                        className="rounded-lg border bg-card p-3 group hover:bg-accent/20 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm">{t.name}</h4>
                            {t.sampleType && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t.sampleType}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-normal shrink-0 ${
                              t.status === 'Inactive'
                                ? 'border-rose-500/40 text-rose-600 dark:text-rose-400'
                                : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {t.status}
                          </Badge>
                        </div>
                        {t.referenceRange && (
                          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
                            Ref: {t.referenceRange}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(t.price)}</span>
                          {t._count && t._count.patientTests > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t._count.patientTests} order{t._count.patientTests === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(t.id)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(t)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the lab test from the catalog. You can only delete tests that have no patient orders — deactivate instead if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteTest(deleteTarget)}
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
