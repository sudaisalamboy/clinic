'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Loader2, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DialogDescription,
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
import { apiFetch, apiFetchList } from '@/lib/api-client'
import { fmtCurrency, fmtDate, toDateInput, isExpiringSoon, isExpired } from './utils'
import { DatePicker } from './date-picker'
import { EmptyState } from './empty-state'
import { LoadingDots } from './skeletons'
import { ListTruncatedNotice } from './list-truncated-notice'

interface Category { id: string; name: string }
interface Supplier { id: string; name: string }
interface Item {
  id: string
  name: string
  categoryId: string
  category?: { id: string; name: string } | null
  supplierId?: string | null
  supplier?: { id: string; name: string } | null
  batchNumber?: string | null
  expiryDate?: string | null
  unit?: string | null
  quantity: number
  minStock: number
  purchasePrice: number
  sellingPrice: number
  mrp: number
  gst: number
  status: string
}

const empty: Partial<Item> = {
  name: '',
  categoryId: '',
  supplierId: '',
  batchNumber: '',
  expiryDate: '',
  unit: '',
  quantity: 0,
  minStock: 10,
  purchasePrice: 0,
  sellingPrice: 0,
  mrp: 0,
  gst: 0,
  status: 'Active',
}

export function InventoryPanel({ currency = '₹', role }: { currency?: string; role?: string }) {
  const isAdmin = role === 'Admin'
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm] = useState<Partial<Item>>(empty)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [stockOpen, setStockOpen] = useState(false)
  const [stockItem, setStockItem] = useState<Item | null>(null)
  const [stockType, setStockType] = useState<'in' | 'out' | 'adjust' | 'return'>('in')
  const [stockQty, setStockQty] = useState('')
  const [stockNote, setStockNote] = useState('')
  const [stockSaving, setStockSaving] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const { toast } = useToast()

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: count } = await apiFetchList<Item>(
        `/api/inventory/items?q=${encodeURIComponent(q)}&category=${category}&filter=${filter}`,
      )
      setItems(data)
      setTotal(count)
    } catch {
      toast({ title: 'Failed to load items', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [q, category, filter, toast])

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetch<Category[]>('/api/inventory/categories')
      setCategories(data)
    } catch {
      toast({ title: 'Failed to load categories', variant: 'destructive' })
    }
  }, [toast])

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await apiFetch<Supplier[]>('/api/suppliers')
      setSuppliers(data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    loadCategories()
    loadSuppliers()
  }, [loadCategories, loadSuppliers])

  useEffect(() => {
    if (tab === 'items') {
      const t = setTimeout(loadItems, 200)
      return () => clearTimeout(t)
    }
  }, [loadItems, tab])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty, categoryId: categories[0]?.id || '' })
    setOpen(true)
  }
  const openEdit = (it: Item) => {
    setEditing(it)
    setForm({
      ...it,
      expiryDate: it.expiryDate ? toDateInput(it.expiryDate) : '',
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name || !form.categoryId) {
      toast({ title: 'Name and category are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/inventory/items/${editing.id}` : '/api/inventory/items'
      const method = editing ? 'PUT' : 'POST'
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      toast({ title: editing ? 'Item updated' : 'Item created' })
      setOpen(false)
      loadItems()
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteId) return
    try {
      await apiFetch(`/api/inventory/items/${deleteId}`, { method: 'DELETE' })
      toast({ title: 'Item deactivated', description: 'History is preserved; reactivate it via Edit' })
      setDeleteId(null)
      loadItems()
    } catch {
      toast({ title: 'Deactivate failed', variant: 'destructive' })
    }
  }

  const openStock = (it: Item, type: 'in' | 'out' | 'adjust' | 'return') => {
    setStockItem(it)
    setStockType(type)
    setStockQty('')
    setStockNote('')
    setStockOpen(true)
  }

  const submitStock = async () => {
    if (!stockItem) return
    const qty = Number(stockQty)
    if (!Number.isFinite(qty) || qty < 0 || (stockType !== 'adjust' && qty <= 0)) {
      toast({ title: 'Quantity must be a positive number', variant: 'destructive' })
      return
    }
    setStockSaving(true)
    try {
      const data = await apiFetch<{ item: { quantity: number } }>('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: stockItem.id, type: stockType, quantity: qty, note: stockNote }),
      })
      toast({ title: 'Stock updated', description: `New level: ${data.item?.quantity ?? '?'}` })
      setStockOpen(false)
      loadItems()
    } catch (err) {
      toast({ title: 'Stock update failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setStockSaving(false)
    }
  }

  const addCategory = async () => {
    if (!newCategory) return
    setCatSaving(true)
    try {
      await apiFetch('/api/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory }),
      })
      toast({ title: 'Category added' })
      setNewCategory('')
      loadCategories()
    } catch {
      toast({ title: 'Failed to add category', variant: 'destructive' })
    } finally {
      setCatSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="items">
            <Package className="h-4 w-4" /> Items
          </TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle>Inventory Items</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items..." className="pl-8 w-48" />
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="expiring">Expiring</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700" disabled={!isAdmin} title={isAdmin ? undefined : 'Admin role required'}>
                  <Plus className="h-4 w-4" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingDots text="Loading inventory" />
              ) : items.length === 0 ? (
                <EmptyState variant="search" title="No items found" description="Try adjusting your search or add a new item" />
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Selling</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, i) => {
                        const low = it.quantity <= it.minStock
                        const expSoon = isExpiringSoon(it.expiryDate)
                        const expired = isExpired(it.expiryDate)
                        return (
                          <motion.tr
                            key={it.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="hover:bg-muted/50 border-b transition-colors row-hover"
                          >
                            <TableCell className="font-medium p-2">{it.name}</TableCell>
                            <TableCell className="p-2">{it.category?.name || '—'}</TableCell>
                            <TableCell className="p-2">{it.batchNumber || '—'}</TableCell>
                            <TableCell className="p-2">
                              <div className="flex items-center gap-1">
                                {fmtDate(it.expiryDate)}
                                {expired && <Badge variant="destructive" className="ml-1">Expired</Badge>}
                                {expSoon && !expired && (
                                  <Badge className="ml-1 bg-amber-100 text-amber-800">Expiring</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="flex items-center gap-1">
                                <span className={low ? 'text-destructive font-semibold' : ''}>{it.quantity}</span>
                                {it.unit && <span className="text-xs text-muted-foreground">{it.unit}</span>}
                                {low && <AlertTriangle className="h-3 w-3 text-destructive" />}
                              </div>
                            </TableCell>
                            <TableCell className="p-2">{fmtCurrency(it.sellingPrice, currency)}</TableCell>
                            <TableCell className="p-2">
                              <Badge variant={it.status === 'Active' ? 'default' : 'secondary'}>
                                {it.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="p-2 text-right">
                              <Button variant="ghost" size="icon" title="Stock In" onClick={() => openStock(it, 'in')}>
                                <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Stock Out" onClick={() => openStock(it, 'out')}>
                                <ArrowUpFromLine className="h-4 w-4 text-amber-600" />
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(it)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Deactivate" onClick={() => setDeleteId(it.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </motion.tr>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <ListTruncatedNotice shown={items.length} total={total} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle>Inventory Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder={isAdmin ? 'New category name' : 'Admin role required to add categories'}
                  disabled={!isAdmin}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isAdmin) addCategory()
                  }}
                />
                <Button onClick={addCategory} disabled={catSaving || !isAdmin} className="bg-emerald-600 hover:bg-emerald-700">
                  {catSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Badge key={c.id} variant="secondary" className="text-sm py-1.5 px-3">
                    {c.name}
                  </Badge>
                ))}
                {categories.length === 0 && (
                  <span className="text-muted-foreground text-sm">No categories yet.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle>
            <DialogDescription className="sr-only">Add or update a medicine or supply in inventory.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.categoryId || ''} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={form.supplierId || 'none'} onValueChange={(v) => setForm({ ...form, supplierId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Batch Number</Label>
              <Input value={form.batchNumber || ''} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <DatePicker
                value={form.expiryDate ? toDateInput(form.expiryDate) : ''}
                onChange={(v) => setForm({ ...form, expiryDate: v ? new Date(v).toISOString() : '' })}
                withTime={false}
                placeholder="Select expiry date"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="box, strip, piece..." />
            </div>
            <div className="space-y-2">
              <Label>{editing ? 'Quantity (locked — use Stock In/Out)' : 'Quantity'}</Label>
              <Input
                type="number"
                value={form.quantity ?? 0}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                disabled={!!editing}
                readOnly={!!editing}
                title={editing ? 'Stock changes must go through Stock In / Stock Out so every movement is recorded' : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label>Min Stock</Label>
              <Input type="number" value={form.minStock ?? 0} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Purchase Price ({currency})</Label>
              <Input type="number" value={form.purchasePrice ?? 0} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Selling Price ({currency})</Label>
              <Input type="number" value={form.sellingPrice ?? 0} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>MRP ({currency})</Label>
              <Input type="number" value={form.mrp ?? 0} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>GST (%)</Label>
              <Input type="number" value={form.gst ?? 0} onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })} />
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

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Stock Movement — {stockItem?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Record stock in, out, return, or a stock-take adjustment. Every movement is kept in the ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Current stock: <span className="font-semibold text-foreground">{stockItem?.quantity}</span>
            </div>
            <div className="space-y-2">
              <Label>Movement Type</Label>
              <Select value={stockType} onValueChange={(v: 'in' | 'out' | 'adjust' | 'return') => setStockType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In (add delivered stock)</SelectItem>
                  <SelectItem value="out">Stock Out (damage / expiry / use)</SelectItem>
                  <SelectItem value="return">Return (patient/bill return — adds back)</SelectItem>
                  <SelectItem value="adjust">Adjust (set exact counted level)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{stockType === 'adjust' ? 'New counted quantity *' : 'Quantity *'}</Label>
              <Input
                type="number"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder={stockType === 'adjust' ? 'exact new level' : '1'}
                autoFocus
              />
              {stockType === 'adjust' && (
                <p className="text-xs text-muted-foreground">
                  Sets stock to this exact number (stock-take correction).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Reason / reference" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button>
            <Button
              onClick={submitStock}
              disabled={stockSaving}
              className={stockType === 'in' || stockType === 'return' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {stockSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this item?</AlertDialogTitle>
            <AlertDialogDescription>
              The item is hidden from billing and alerts but its full stock history is
              preserved for audit. It can be reactivated later via Edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
