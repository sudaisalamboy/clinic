'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  Package,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
  PackagePlus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '../format'

interface Medicine {
  id: string
  name: string
  sku: string | null
  quantity: number
  price: number
  reorderLevel: number
  updatedAt: string
}

export function InventoryPanel() {
  const { toast } = useToast()
  const [meds, setMeds] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Medicine>>({})
  const [restockId, setRestockId] = useState<string | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', sku: '', quantity: '0', price: '0', reorderLevel: '10' })

  const load = useCallback(async () => {
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
    void load()
  }, [load])

  function startEdit(m: Medicine) {
    setEditingId(m.id)
    setDraft({
      name: m.name,
      sku: m.sku,
      quantity: m.quantity,
      price: m.price,
      reorderLevel: m.reorderLevel,
    })
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/medicines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          sku: draft.sku || null,
          quantity: draft.quantity,
          price: draft.price,
          reorderLevel: draft.reorderLevel,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'save failed')
      }
      const data = await res.json()
      setMeds((prev) => prev.map((m) => (m.id === id ? data.medicine : m)))
      setEditingId(null)
      toast({ title: 'Medicine updated' })
    } catch (e) {
      toast({
        title: 'Failed to update medicine',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function doRestock(id: string) {
    const qty = parseInt(restockQty, 10)
    if (!qty || qty <= 0) return
    try {
      const res = await fetch(`/api/medicines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restockBy: qty }),
      })
      if (!res.ok) throw new Error('restock failed')
      const data = await res.json()
      setMeds((prev) => prev.map((m) => (m.id === id ? data.medicine : m)))
      setRestockId(null)
      setRestockQty('')
      toast({ title: `Restocked +${qty}` })
    } catch {
      toast({ title: 'Failed to restock', variant: 'destructive' })
    }
  }

  async function deleteMed(id: string) {
    const prev = meds
    setMeds((p) => p.filter((m) => m.id !== id))
    try {
      await fetch(`/api/medicines/${id}`, { method: 'DELETE' })
      toast({ title: 'Medicine deleted' })
    } catch {
      setMeds(prev)
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  async function addMedicine() {
    if (!newMed.name.trim()) return
    try {
      const res = await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMed.name.trim(),
          sku: newMed.sku.trim() || null,
          quantity: parseInt(newMed.quantity || '0', 10),
          price: parseFloat(newMed.price || '0'),
          reorderLevel: parseInt(newMed.reorderLevel || '10', 10),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'add failed')
      setMeds((prev) => [data.medicine, ...prev])
      setNewMed({ name: '', sku: '', quantity: '0', price: '0', reorderLevel: '10' })
      setShowAdd(false)
      toast({ title: 'Medicine added' })
    } catch (e) {
      toast({
        title: 'Failed to add medicine',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const totalValue = meds.reduce((s, m) => s + m.quantity * m.price, 0)
  const lowStock = meds.filter((m) => m.quantity < 10).length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
            <Badge variant="secondary" className="font-normal">{meds.length}</Badge>
            {lowStock > 0 && (
              <Badge variant="outline" className="font-normal border-rose-500/40 text-rose-600 dark:text-rose-400">
                {lowStock} low
              </Badge>
            )}
            <Badge variant="outline" className="font-normal hidden sm:inline-flex">
              {formatCurrency(totalValue)} value
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search medicines…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Button onClick={() => setShowAdd((v) => !v)} size="sm">
              <Plus className="h-3.5 w-3.5" />
              Add medicine
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-md border bg-muted/20 p-3 mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-xs">Name *</Label>
                  <Input value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="Paracetamol" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SKU</Label>
                  <Input value={newMed.sku} onChange={(e) => setNewMed({ ...newMed, sku: e.target.value })} placeholder="MED-001" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" min={0} value={newMed.quantity} onChange={(e) => setNewMed({ ...newMed, quantity: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price ($)</Label>
                  <Input type="number" min={0} step="0.01" value={newMed.price} onChange={(e) => setNewMed({ ...newMed, price: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reorder at</Label>
                  <Input type="number" min={0} value={newMed.reorderLevel} onChange={(e) => setNewMed({ ...newMed, reorderLevel: e.target.value })} />
                </div>
                <div className="col-span-2 sm:col-span-5 flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button size="sm" onClick={addMedicine} disabled={!newMed.name.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : meds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">{query ? 'No medicines match.' : 'No medicines yet.'}</p>
            {!query && (
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add your first medicine
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {meds.map((m) => {
                  const low = m.quantity < 10
                  const critical = m.quantity < (m.reorderLevel / 2)
                  return (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-lg border bg-card p-3"
                    >
                      {editingId === m.id ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div className="col-span-2 sm:col-span-1 space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">SKU</Label>
                            <Input value={draft.sku ?? ''} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Qty</Label>
                            <Input type="number" min={0} value={draft.quantity ?? 0} onChange={(e) => setDraft({ ...draft, quantity: parseInt(e.target.value || '0', 10) })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Price</Label>
                            <Input type="number" min={0} step="0.01" value={draft.price ?? 0} onChange={(e) => setDraft({ ...draft, price: parseFloat(e.target.value || '0') })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Reorder at</Label>
                            <Input type="number" min={0} value={draft.reorderLevel ?? 10} onChange={(e) => setDraft({ ...draft, reorderLevel: parseInt(e.target.value || '10', 10) })} />
                          </div>
                          <div className="col-span-2 sm:col-span-5 flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5" /> Cancel
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(m.id)}>
                              <Check className="h-3.5 w-3.5" /> Save
                            </Button>
                          </div>
                        </div>
                      ) : restockId === m.id ? (
                        <div className="flex items-center gap-2">
                          <PackagePlus className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm">Restock</span>
                          <Input
                            type="number"
                            min={1}
                            value={restockQty}
                            onChange={(e) => setRestockQty(e.target.value)}
                            placeholder="qty"
                            className="w-20"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => doRestock(m.id)} disabled={!restockQty}>
                            <Check className="h-3.5 w-3.5" /> Confirm
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setRestockId(null); setRestockQty('') }}>
                            <X className="h-3.5 w-3.5" /> Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-sm">{m.name}</h3>
                              {m.sku && (
                                <Badge variant="outline" className="text-xs font-mono font-normal">{m.sku}</Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-xs font-normal ${
                                  m.quantity <= 0
                                    ? 'border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-500/5'
                                    : critical
                                      ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5'
                                      : low
                                        ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                                        : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                                }`}
                              >
                                {m.quantity <= 0 ? 'Out of stock' : `${m.quantity} in stock`}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatCurrency(m.price)} · reorder at {m.reorderLevel}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                              onClick={() => { setRestockId(m.id); setRestockQty('') }}
                              title="Restock"
                            >
                              <PackagePlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMed(m.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
