'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Eye, Loader2, Plus, Printer, Receipt, Search, Trash2, X } from 'lucide-react'
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
import { fmtCurrency, fmtDateTime } from './utils'
import { DatePicker } from './date-picker'
import { EmptyState } from './empty-state'
import { LoadingDots } from './skeletons'

interface InventoryItem {
  id: string
  name: string
  sellingPrice: number
  quantity: number
}
interface Appointment {
  id: string
  patientName: string
  mobile?: string | null
  staff?: { name: string } | null
  date: string | Date
}
interface BillItem {
  id: string
  itemId?: string | null
  name: string
  qty: number
  price: number
}
interface Bill {
  id: string
  billNumber: string
  appointmentId?: string | null
  patientName: string
  mobile?: string | null
  consultationCharge: number
  medicineCharge: number
  discount: number
  discountType: string
  gst: number
  grandTotal: number
  paymentMethod: string
  paymentStatus: string
  notes?: string | null
  createdAt: string | Date
  items?: BillItem[]
}

function calcGrand(input: {
  consultation: number
  items: { qty: number; price: number }[]
  discount: number
  discountType: string
  gst: number
}) {
  const med = input.items.reduce((s, i) => s + i.qty * i.price, 0)
  const subtotal = input.consultation + med
  let discountAmount = 0
  if (input.discountType === 'percent') {
    discountAmount = (subtotal * Math.max(0, input.discount || 0)) / 100
  } else {
    discountAmount = Math.max(0, input.discount || 0)
  }
  discountAmount = Math.min(discountAmount, subtotal)
  const afterDiscount = subtotal - discountAmount
  const gstAmount = (afterDiscount * Math.max(0, input.gst || 0)) / 100
  const total = afterDiscount + gstAmount
  return {
    medicine: Math.round(med * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  }
}

export function BillingPanel({ currency = '₹' }: { currency?: string }) {
  const [items, setItems] = useState<Bill[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<Bill | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState<any>({
    patientName: '',
    mobile: '',
    appointmentId: '',
    consultationCharge: 0,
    items: [] as { itemId?: string; name: string; qty: number; price: number }[],
    discount: 0,
    discountType: 'fixed',
    gst: 0,
    paymentMethod: 'Cash',
    paymentStatus: 'Pending',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/bills?${params.toString()}`)
      const data = await res.json()
      setItems(data)
    } catch {
      toast({ title: 'Failed to load bills', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [q, status, from, to, toast])

  useEffect(() => {
    fetch('/api/inventory/items?filter=all').then((r) => r.json()).then(setInventory).catch(() => {})
    fetch('/api/appointments?status=Pending').then((r) => r.json()).then(setAppointments).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const calc = useMemo(
    () =>
      calcGrand({
        consultation: Number(form.consultationCharge) || 0,
        items: form.items,
        discount: Number(form.discount) || 0,
        discountType: form.discountType,
        gst: Number(form.gst) || 0,
      }),
    [form],
  )

  const openCreate = () => {
    setForm({
      patientName: '',
      mobile: '',
      appointmentId: '',
      consultationCharge: 0,
      items: [],
      discount: 0,
      discountType: 'fixed',
      gst: 0,
      paymentMethod: 'Cash',
      paymentStatus: 'Pending',
      notes: '',
    })
    setOpen(true)
  }

  const addLine = (itemId: string) => {
    if (!itemId) return
    const inv = inventory.find((i) => i.id === itemId)
    if (!inv) return
    if (form.items.find((i: any) => i.itemId === itemId)) {
      toast({ title: 'Item already added' })
      return
    }
    setForm({
      ...form,
      items: [...form.items, { itemId: inv.id, name: inv.name, qty: 1, price: inv.sellingPrice }],
    })
  }

  const updateLine = (idx: number, patch: Partial<{ qty: number; price: number }>) => {
    setForm({
      ...form,
      items: form.items.map((it: any, i: number) => (i === idx ? { ...it, ...patch } : it)),
    })
  }

  const removeLine = (idx: number) => {
    setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) })
  }

  const applyAppointment = (id: string) => {
    setForm({ ...form, appointmentId: id })
    const a = appointments.find((x) => x.id === id)
    if (a) {
      setForm((f: any) => ({ ...f, appointmentId: id, patientName: a.patientName, mobile: a.mobile || f.mobile }))
    }
  }

  const save = async () => {
    if (!form.patientName) {
      toast({ title: 'Patient name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast({ title: 'Bill created', description: data.billNumber })
      setOpen(false)
      load()
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (bill: Bill, newStatus: string) => {
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      toast({ title: `Marked ${newStatus}` })
      load()
      if (view?.id === bill.id) {
        const r = await fetch(`/api/bills/${bill.id}`)
        if (r.ok) setView(await r.json())
      }
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' })
    }
  }

  const remove = async () => {
    if (!deleteId) return
    try {
      await fetch(`/api/bills/${deleteId}`, { method: 'DELETE' })
      toast({ title: 'Bill deleted' })
      setDeleteId(null)
      load()
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
  }

  const printBill = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      <Card className="hover-lift">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle>Bills</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="pl-8 w-48"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <DatePicker value={from} onChange={(v) => setFrom(v.slice(0, 10))} withTime={false} placeholder="From" className="w-36" />
            <DatePicker value={to} onChange={(v) => setTo(v.slice(0, 10))} withTime={false} placeholder="To" className="w-36" />
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> Generate Bill
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingDots text="Loading bills" />
          ) : items.length === 0 ? (
            <EmptyState variant="search" title="No bills found" description="Generate a bill to get started" />
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((b, i) => (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-muted/50 border-b transition-colors row-hover"
                    >
                      <TableCell className="font-mono text-xs p-2">{b.billNumber}</TableCell>
                      <TableCell className="font-medium p-2">{b.patientName}</TableCell>
                      <TableCell className="p-2">{b.mobile || '—'}</TableCell>
                      <TableCell className="p-2">{fmtDateTime(b.createdAt)}</TableCell>
                      <TableCell className="p-2 font-semibold">{fmtCurrency(b.grandTotal, currency)}</TableCell>
                      <TableCell className="p-2">{b.paymentMethod}</TableCell>
                      <TableCell className="p-2">
                        <Badge variant={b.paymentStatus === 'Paid' ? 'default' : 'secondary'}>
                          {b.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setView(b)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {b.paymentStatus === 'Pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Mark Paid"
                            onClick={() => updateStatus(b, 'Paid')}
                          >
                            <Receipt className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id)}>
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Appointment (optional)</Label>
                <Select value={form.appointmentId || 'none'} onValueChange={applyAppointment}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select appointment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {appointments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.patientName} — {fmtDateTime(a.date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Patient Name *</Label>
                <Input value={form.patientName || ''} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input value={form.mobile || ''} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Consultation Charge ({currency})</Label>
                <Input
                  type="number"
                  value={form.consultationCharge || 0}
                  onChange={(e) => setForm({ ...form, consultationCharge: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Add Medicine / Item</Label>
              <Select value="" onValueChange={addLine}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select item to add" />
                </SelectTrigger>
                <SelectContent>
                  {inventory
                    .filter((i) => i.quantity > 0)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} — {fmtCurrency(i.sellingPrice, currency)} (stock: {i.quantity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {form.items.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-32">Price</TableHead>
                      <TableHead className="w-32">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((it: any, idx: number) => (
                      <TableRow key={idx} className="row-hover">
                        <TableCell className="p-2">{it.name}</TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={it.qty}
                            onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={it.price}
                            onChange={(e) => updateLine(idx, { price: Number(e.target.value) })}
                            className="h-8 w-28"
                          />
                        </TableCell>
                        <TableCell className="p-2">{fmtCurrency(it.qty * it.price, currency)}</TableCell>
                        <TableCell className="p-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed ({currency})</SelectItem>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount</Label>
                <Input
                  type="number"
                  value={form.discount || 0}
                  onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>GST (%)</Label>
                <Input
                  type="number"
                  value={form.gst || 0}
                  onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={form.paymentStatus} onValueChange={(v) => setForm({ ...form, paymentStatus: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Notes</Label>
                <Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Consultation</span><span>{fmtCurrency(Number(form.consultationCharge) || 0, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Medicine Charge</span><span>{fmtCurrency(calc.medicine, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtCurrency(calc.subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>− {fmtCurrency(calc.discountAmount, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>+ {fmtCurrency(calc.gstAmount, currency)}</span></div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t mt-2"><span>Grand Total</span><span>{fmtCurrency(calc.total, currency)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Bill {view?.billNumber}</span>
              <Button variant="outline" size="sm" onClick={printBill}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          {view && (
            <div className="space-y-4 printable">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Patient</div>
                  <div className="font-medium">{view.patientName}</div>
                  {view.mobile && <div className="text-muted-foreground">{view.mobile}</div>}
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Date</div>
                  <div>{fmtDateTime(view.createdAt)}</div>
                  <div className="text-muted-foreground mt-1">Status</div>
                  <Badge variant={view.paymentStatus === 'Paid' ? 'default' : 'secondary'}>{view.paymentStatus}</Badge>
                </div>
              </div>

              {view.items && view.items.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {view.items.map((it) => (
                        <TableRow key={it.id} className="row-hover">
                          <TableCell className="p-2">{it.name}</TableCell>
                          <TableCell className="p-2">{it.qty}</TableCell>
                          <TableCell className="p-2">{fmtCurrency(it.price, currency)}</TableCell>
                          <TableCell className="p-2 text-right">{fmtCurrency(it.qty * it.price, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="rounded-md border bg-muted/30 p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Consultation</span><span>{fmtCurrency(view.consultationCharge, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Medicine Charge</span><span>{fmtCurrency(view.medicineCharge, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount ({view.discountType})</span><span>− {fmtCurrency(view.discount, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>+ {fmtCurrency(view.gst, currency)}%</span></div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t mt-2">
                  <span>Grand Total</span><span>{fmtCurrency(view.grandTotal, currency)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {view.paymentStatus === 'Pending' && (
                  <Button onClick={() => updateStatus(view, 'Paid')} className="bg-emerald-600 hover:bg-emerald-700">
                    Mark Paid
                  </Button>
                )}
                {view.paymentStatus === 'Paid' && (
                  <Button variant="outline" onClick={() => updateStatus(view, 'Pending')}>
                    Mark Pending
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
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
