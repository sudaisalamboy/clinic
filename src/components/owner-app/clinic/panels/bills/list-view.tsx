'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  ReceiptText,
  Eye,
  Trash2,
  ChevronDown,
  ChevronRight,
  Printer,
  DollarSign,
  Clock,
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
import { formatCurrency, formatDateTime } from '../../format'
import {
  type BillListItem,
  type BillStatus,
  ALL_BILL_STATUSES,
  BILL_STATUS_META,
  balanceDue,
} from './bill-helpers'

interface Props {
  onOpenBill: (id: string) => void
  onGenerate: () => void
  refreshKey: number
}

export function AllBillsView({ onOpenBill, onGenerate, refreshKey }: Props) {
  const { toast } = useToast()
  const [bills, setBills] = useState<BillListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillListItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/bills?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      // Client-side search filter (billNumber, patient name, patientCode)
      let filtered = data.bills as BillListItem[]
      if (query.trim()) {
        const q = query.toLowerCase()
        filtered = filtered.filter(
          (b) =>
            b.billNumber.toLowerCase().includes(q) ||
            b.patient.name.toLowerCase().includes(q) ||
            b.patient.patientCode.toLowerCase().includes(q),
        )
      }
      setBills(filtered)
    } catch {
      toast({ title: 'Failed to load bills', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, query, toast])

  useEffect(() => { void load() }, [load, refreshKey])

  async function deleteBill(b: BillListItem) {
    setDeleteTarget(null)
    try {
      await fetch(`/api/bills/${b.id}`, { method: 'DELETE' })
      toast({ title: 'Bill deleted' })
      void load()
    } catch {
      toast({ title: 'Failed to delete bill', variant: 'destructive' })
    }
  }

  const totalBilled = bills.reduce((s, b) => s + b.total, 0)
  const totalCollected = bills.reduce((s, b) => s + b.amountPaid, 0)
  const totalOutstanding = bills.reduce((s, b) => s + balanceDue(b.total, b.amountPaid), 0)

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
                Billed: <span className="font-semibold text-foreground">{formatCurrency(totalBilled)}</span>
              </span>
              <span className="text-muted-foreground">
                Collected: <span className="font-semibold text-emerald-600">{formatCurrency(totalCollected)}</span>
              </span>
              <span className="text-muted-foreground">
                Outstanding: <span className="font-semibold text-amber-600">{formatCurrency(totalOutstanding)}</span>
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bill #, patient…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_BILL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onGenerate}>
              <ReceiptText className="h-3.5 w-3.5" />
              Generate
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
            <Button size="sm" variant="outline" onClick={onGenerate}>
              <ReceiptText className="h-3.5 w-3.5" />
              Generate your first bill
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {bills.map((b) => {
                  const isOpen = expanded === b.id
                  const status = b.status as BillStatus
                  const meta = BILL_STATUS_META[status] ?? BILL_STATUS_META.Pending
                  const due = balanceDue(b.total, b.amountPaid)
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
                              <span className="font-mono text-xs text-muted-foreground">{b.billNumber}</span>
                              <span className="font-medium text-sm">{b.patient.name}</span>
                              <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
                                {status}
                              </Badge>
                              {b.paymentMethod && (
                                <Badge variant="outline" className="text-xs font-normal">{b.paymentMethod}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-6">
                              {formatDateTime(b.createdAt)} · {b.items.length} item{b.items.length === 1 ? '' : 's'}
                              {b.doctor && ` · Dr. ${b.doctor.name}`}
                              {b._count.payments > 0 && ` · ${b._count.payments} payment${b._count.payments === 1 ? '' : 's'}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-sm tabular-nums">{formatCurrency(b.total)}</div>
                            {due > 0 && status !== 'Refunded' && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                                Due: {formatCurrency(due)}
                              </div>
                            )}
                            {status === 'Paid' && (
                              <div className="text-xs text-emerald-600 dark:text-emerald-400">Paid in full</div>
                            )}
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
                              {/* Itemized breakdown */}
                              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                                <div className="space-y-1">
                                  <p className="font-medium text-muted-foreground uppercase tracking-wide">Charges</p>
                                  <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(b.subtotal)}</span></div>
                                  {b.discountAmount > 0 && (
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                      <span>Discount</span>
                                      <span className="tabular-nums">−{formatCurrency(b.discountAmount)}</span>
                                    </div>
                                  )}
                                  {b.taxAmount > 0 && (
                                    <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{formatCurrency(b.taxAmount)}</span></div>
                                  )}
                                  <div className="flex justify-between font-medium pt-1 border-t"><span>Total</span><span className="tabular-nums">{formatCurrency(b.total)}</span></div>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-medium text-muted-foreground uppercase tracking-wide">Payment</p>
                                  <div className="flex justify-between"><span>Paid</span><span className="tabular-nums text-emerald-600">{formatCurrency(b.amountPaid)}</span></div>
                                  <div className="flex justify-between"><span>Outstanding</span><span className="tabular-nums text-amber-600">{formatCurrency(due)}</span></div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 justify-end flex-wrap">
                                <Button size="sm" variant="outline" onClick={() => onOpenBill(b.id)}>
                                  <Eye className="h-3.5 w-3.5" />
                                  View / Pay
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => onOpenBill(b.id)}>
                                  <Printer className="h-3.5 w-3.5" />
                                  Print
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(b)}
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
            <AlertDialogTitle>Delete bill {deleteTarget?.billNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the bill and all its payment records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteBill(deleteTarget)}
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
