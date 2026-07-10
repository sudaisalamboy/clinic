'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  ReceiptText,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Printer,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useQuickActions } from '../quick-actions-context'
import { formatCurrency, formatDateTime } from '../format'

interface BillItem {
  name: string
  qty: number
  price: number
}
interface Bill {
  id: string
  patientId: string
  items: BillItem[]
  total: number
  status: string
  createdAt: string
  patient: { id: string; name: string; phone: string | null }
}

export function BillsPanel() {
  const { openAction } = useQuickActions()
  const { toast } = useToast()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const url = statusFilter !== 'all' ? `/api/bills?status=${statusFilter}` : '/api/bills'
      const res = await fetch(url)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setBills(data.bills)
    } catch {
      toast({ title: 'Failed to load bills', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function markPaid(id: string) {
    const prev = bills
    setBills((p) => p.map((b) => (b.id === id ? { ...b, status: 'paid' } : b)))
    try {
      await fetch(`/api/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      toast({ title: 'Bill marked as paid' })
    } catch {
      setBills(prev)
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  async function markPending(id: string) {
    const prev = bills
    setBills((p) => p.map((b) => (b.id === id ? { ...b, status: 'pending' } : b)))
    try {
      await fetch(`/api/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      })
      toast({ title: 'Bill marked as pending' })
    } catch {
      setBills(prev)
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  async function deleteBill(id: string) {
    const prev = bills
    setBills((p) => p.filter((b) => b.id !== id))
    try {
      await fetch(`/api/bills/${id}`, { method: 'DELETE' })
      toast({ title: 'Bill deleted' })
    } catch {
      setBills(prev)
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const totalPending = bills.filter((b) => b.status === 'pending').reduce((s, b) => s + b.total, 0)
  const totalPaid = bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.total, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ReceiptText className="h-4 w-4" />
            Bills
            <Badge variant="secondary" className="font-normal">{bills.length}</Badge>
          </CardTitle>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                Pending: <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(totalPending)}</span>
              </span>
              <span className="text-muted-foreground">
                Paid: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</span>
              </span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => openAction('generate-bill')} size="sm">
              <ReceiptText className="h-3.5 w-3.5" />
              Generate bill
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ReceiptText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm mb-3">No bills found.</p>
            <Button size="sm" variant="outline" onClick={() => openAction('generate-bill')}>
              <ReceiptText className="h-3.5 w-3.5" />
              Generate your first bill
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {bills.map((b) => {
                  const isOpen = expanded === b.id
                  const paid = b.status === 'paid'
                  return (
                    <motion.div
                      key={b.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-lg border bg-card"
                    >
                      <button
                        onClick={() => setExpanded(isOpen ? null : b.id)}
                        className="w-full text-left p-3 hover:bg-accent/20 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              <h3 className="font-medium text-sm">{b.patient.name}</h3>
                              <Badge
                                variant="outline"
                                className={`text-xs font-normal ${
                                  paid
                                    ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                                    : 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                                }`}
                              >
                                {paid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                {paid ? 'Paid' : 'Pending'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-6">
                              {formatDateTime(b.createdAt)} · {b.items.length} item{b.items.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm tabular-nums">{formatCurrency(b.total)}</div>
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
                              <div className="space-y-1">
                                {b.items.map((it, i) => (
                                  <div key={i} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      {it.name} <span className="text-muted-foreground/70">× {it.qty}</span>
                                    </span>
                                    <span className="tabular-nums">{formatCurrency(it.qty * it.price)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm pt-1 border-t mt-1">
                                  <span className="font-medium">Total</span>
                                  <span className="font-semibold tabular-nums">{formatCurrency(b.total)}</span>
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.print()}
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  Print
                                </Button>
                                {paid ? (
                                  <Button size="sm" variant="outline" onClick={() => markPending(b.id)}>
                                    Mark as pending
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={() => markPaid(b.id)}>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Mark as paid
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => deleteBill(b.id)}
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
    </Card>
  )
}
