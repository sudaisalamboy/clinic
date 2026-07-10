'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  Package,
  Pencil,
  Trash2,
  Plus,
  PackagePlus,
  AlertTriangle,
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
import { formatCurrency, formatDate } from '../../format'
import {
  type Medicine,
  stockStatus,
  expiryStatus,
  marginPercent,
} from './inventory-helpers'

interface Props {
  onAdd: () => void
  onEdit: (id: string) => void
  refreshKey: number
}

export function MedicineStockView({ onAdd, onEdit, refreshKey }: Props) {
  const { toast } = useToast()
  const [meds, setMeds] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null)
  const [restockTarget, setRestockTarget] = useState<Medicine | null>(null)
  const [restockQty, setRestockQty] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/medicines${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setMeds(data.medicines)
    } catch {
      toast({ title: 'Failed to load medicines', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [query, toast])

  useEffect(() => {
    const id = setTimeout(() => { void load() }, 300)
    return () => clearTimeout(id)
  }, [query, load])

  useEffect(() => { void load() }, [load, refreshKey])

  async function doRestock() {
    if (!restockTarget) return
    const qty = parseInt(restockQty, 10)
    if (!qty || qty <= 0) return
    try {
      const res = await fetch(`/api/medicines/${restockTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restockBy: qty }),
      })
      if (!res.ok) throw new Error('restock failed')
      toast({ title: `Restocked +${qty}`, description: restockTarget.name })
      setRestockTarget(null)
      setRestockQty('')
      void load()
    } catch {
      toast({ title: 'Failed to restock', variant: 'destructive' })
    }
  }

  async function deleteMed(m: Medicine) {
    setDeleteTarget(null)
    const prev = meds
    setMeds((p) => p.filter((x) => x.id !== m.id))
    try {
      await fetch(`/api/medicines/${m.id}`, { method: 'DELETE' })
      toast({ title: 'Medicine deleted' })
    } catch {
      setMeds(prev)
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const totalValue = meds.reduce((s, m) => s + m.quantity * m.price, 0)
  const totalCost = meds.reduce((s, m) => s + m.quantity * m.purchasePrice, 0)
  const lowCount = meds.filter((m) => m.quantity < m.reorderLevel).length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Medicine stock
            <Badge variant="secondary" className="font-normal">{meds.length}</Badge>
            {lowCount > 0 && (
              <Badge variant="outline" className="font-normal border-amber-500/40 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {lowCount} low
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                Value: <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
              </span>
              <span className="text-muted-foreground">
                Cost: <span className="font-semibold text-foreground">{formatCurrency(totalCost)}</span>
              </span>
              <span className="text-muted-foreground">
                Margin: <span className="font-semibold text-emerald-600">{formatCurrency(totalValue - totalCost)}</span>
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, generic, manufacturer…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[260px]"
              />
            </div>
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add medicine
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : meds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">{query ? 'No medicines match your search.' : 'No medicines yet.'}</p>
            {!query && (
              <Button size="sm" variant="outline" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add your first medicine
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="font-medium px-2 py-2">Name</th>
                    <th className="font-medium px-2 py-2 hidden md:table-cell">Generic</th>
                    <th className="font-medium px-2 py-2 hidden lg:table-cell">Manufacturer</th>
                    <th className="font-medium px-2 py-2 text-right">Stock</th>
                    <th className="font-medium px-2 py-2 text-right hidden sm:table-cell">Sell</th>
                    <th className="font-medium px-2 py-2 text-right hidden md:table-cell">Cost</th>
                    <th className="font-medium px-2 py-2 hidden lg:table-cell">Expiry</th>
                    <th className="font-medium px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {meds.map((m, i) => {
                      const stock = stockStatus(m)
                      const expiry = expiryStatus(m)
                      const margin = marginPercent(m)
                      return (
                        <motion.tr
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ delay: Math.min(i * 0.02, 0.2) }}
                          className="border-b last:border-0 hover:bg-accent/30 transition group"
                        >
                          <td className="px-2 py-2">
                            <div className="font-medium">{m.name}</div>
                            <div className="text-xs text-muted-foreground/70">
                              {m.sku ? `SKU ${m.sku}` : '—'}
                              {m.batchNumber ? ` · Batch ${m.batchNumber}` : ''}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground hidden md:table-cell">
                            {m.genericName ?? '—'}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground hidden lg:table-cell">
                            {m.manufacturer ?? '—'}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-medium tabular-nums">{m.quantity}</span>
                              <Badge variant="outline" className={`text-[10px] font-normal ${stock.cls}`}>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${stock.dotCls}`} />
                                {stock.label}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground/70">
                              reorder at {m.reorderLevel}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums hidden sm:table-cell">
                            {formatCurrency(m.price)}
                            {margin != null && (
                              <div className={`text-[10px] ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {margin >= 0 ? '+' : ''}{margin}% margin
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                            {formatCurrency(m.purchasePrice)}
                          </td>
                          <td className="px-2 py-2 hidden lg:table-cell">
                            {m.expiryDate ? (
                              <div>
                                <div className="text-xs">{formatDate(m.expiryDate)}</div>
                                <Badge variant="outline" className={`text-[10px] font-normal ${expiry.cls}`}>
                                  {expiry.label}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                onClick={() => { setRestockTarget(m); setRestockQty('') }}
                                title="Restock"
                              >
                                <PackagePlus className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(m.id)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(m)}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the medicine from your inventory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMed(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restock dialog */}
      <AlertDialog open={!!restockTarget} onOpenChange={(v) => !v && setRestockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restock {restockTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Current stock: {restockTarget?.quantity ?? 0}. Enter the quantity to add.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="restock-qty">Quantity to add</Label>
            <Input
              id="restock-qty"
              type="number"
              min={1}
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              placeholder="e.g. 50"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRestock} disabled={!restockQty || parseInt(restockQty, 10) <= 0}>
              <PackagePlus className="h-3.5 w-3.5" />
              Confirm restock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
