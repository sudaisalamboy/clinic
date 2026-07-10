'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Printer,
  Loader2,
  Stethoscope,
  DollarSign,
  Banknote,
  CreditCard,
  Globe,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDateTime, formatDate, calculateAge } from '../../format'
import {
  type BillDetail,
  type BillStatus,
  type PaymentMethod,
  BILL_STATUS_META,
  PAYMENT_METHODS,
  PAYMENT_METHOD_META,
  balanceDue,
} from './bill-helpers'

interface Props {
  billId: string
  onBack: () => void
  onChanged: () => void
}

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  Cash: <Banknote className="h-3.5 w-3.5" />,
  Card: <CreditCard className="h-3.5 w-3.5" />,
  Online: <Globe className="h-3.5 w-3.5" />,
}

export function BillDetailsView({ billId, onBack, onChanged }: Props) {
  const { toast } = useToast()
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [due, setDue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash')
  const [payType, setPayType] = useState<'payment' | 'refund'>('payment')
  const [payNote, setPayNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bills/${billId}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setBill(data.bill)
      setDue(data.balanceDue)
    } catch {
      toast({ title: 'Failed to load bill', variant: 'destructive' })
      onBack()
    } finally {
      setLoading(false)
    }
  }, [billId, toast, onBack])

  useEffect(() => { void load() }, [load])

  function openPaymentDialog(type: 'payment' | 'refund') {
    setPayType(type)
    setPayAmount(type === 'payment' ? String(due) : '')
    setPayMethod((bill?.paymentMethod as PaymentMethod) ?? 'Cash')
    setPayNote('')
    setShowPayment(true)
  }

  async function recordPayment() {
    if (!bill) return
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: payType === 'refund' ? 'record-refund' : 'record-payment',
          amount,
          method: payMethod,
          note: payNote.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')
      toast({
        title: payType === 'refund' ? 'Refund recorded' : 'Payment recorded',
        description: `${formatCurrency(amount)} via ${payMethod}`,
      })
      setShowPayment(false)
      setBill(data.bill)
      setDue(data.balanceDue)
      onChanged()
    } catch (e) {
      toast({
        title: 'Failed to record payment',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function markStatus(status: BillStatus) {
    if (!bill) return
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('update failed')
      toast({ title: `Marked as ${status}` })
      void load()
      onChanged()
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  if (loading || !bill) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const status = bill.status as BillStatus
  const meta = BILL_STATUS_META[status] ?? BILL_STATUS_META.Pending
  const pmMeta = bill.paymentMethod ? PAYMENT_METHOD_META[bill.paymentMethod as PaymentMethod] : null

  return (
    <div className="space-y-4">
      {/* Action bar (not printed) */}
      <Card className="print:hidden">
        <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-sm">{bill.billNumber}</span>
            <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
              {status}
            </Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            {due > 0 && status !== 'Refunded' && (
              <Button size="sm" onClick={() => openPaymentDialog('payment')}>
                <DollarSign className="h-3.5 w-3.5" />
                Record payment
              </Button>
            )}
            {bill.amountPaid > 0 && status !== 'Refunded' && (
              <Button size="sm" variant="outline" onClick={() => openPaymentDialog('refund')}>
                <RotateCcw className="h-3.5 w-3.5" />
                Refund
              </Button>
            )}
            {status === 'Pending' && (
              <Button size="sm" variant="outline" onClick={() => markStatus('Paid')}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark paid
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Printable invoice */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-6 sm:p-8 print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Clinic Vault</h1>
              <p className="text-xs text-muted-foreground mt-1">Invoice / Receipt</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold">{bill.billNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatDateTime(bill.createdAt)}</p>
              {bill.appointment && (
                <p className="text-xs text-muted-foreground">
                  Appt: {bill.appointment.tokenNumber ?? '—'}
                </p>
              )}
            </div>
          </div>

          {/* Patient + doctor grid */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Bill To</p>
              <p className="font-medium">{bill.patient.name}</p>
              <p className="text-xs text-muted-foreground">{bill.patient.patientCode}</p>
              {bill.patient.phone && <p className="text-xs text-muted-foreground">{bill.patient.phone}</p>}
              {bill.patient.address && <p className="text-xs text-muted-foreground">{bill.patient.address}</p>}
              {bill.patient.dateOfBirth && (
                <p className="text-xs text-muted-foreground">
                  DOB: {formatDate(bill.patient.dateOfBirth)}
                  {calculateAge(bill.patient.dateOfBirth) != null ? ` (${calculateAge(bill.patient.dateOfBirth)}y)` : ''}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              {bill.doctor && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Doctor</p>
                  <p className="font-medium">{bill.doctor.name}</p>
                  {bill.doctor.specialization && <p className="text-xs text-muted-foreground">{bill.doctor.specialization}</p>}
                  {bill.doctor.department && <p className="text-xs text-muted-foreground">{bill.doctor.department.name}</p>}
                </>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Charge breakdown */}
          <div className="space-y-1.5 mb-4">
            <div className="grid grid-cols-[1fr_auto_90px_90px] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b">
              <div>Description</div>
              <div className="text-center">Qty</div>
              <div className="text-right">Price</div>
              <div className="text-right">Amount</div>
            </div>
            {bill.consultationFee > 0 && (
              <div className="grid grid-cols-[1fr_auto_90px_90px] gap-2 text-sm py-1">
                <div>Consultation {bill.doctor ? `— Dr. ${bill.doctor.name}` : ''}</div>
                <div className="text-center text-muted-foreground">1</div>
                <div className="text-right tabular-nums">{formatCurrency(bill.consultationFee)}</div>
                <div className="text-right tabular-nums">{formatCurrency(bill.consultationFee)}</div>
              </div>
            )}
            {bill.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_90px_90px] gap-2 text-sm py-1">
                <div>
                  {it.name}
                  <Badge variant="outline" className="ml-2 text-[10px] font-normal capitalize">{it.category}</Badge>
                </div>
                <div className="text-center text-muted-foreground">{it.qty}</div>
                <div className="text-right tabular-nums">{formatCurrency(it.price)}</div>
                <div className="text-right tabular-nums">{formatCurrency(it.qty * it.price)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-[280px] space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(bill.subtotal)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount {bill.discountType === 'percent' ? `(${bill.discountValue}%)` : ''}</span>
                  <span className="tabular-nums">−{formatCurrency(bill.discountAmount)}</span>
                </div>
              )}
              {bill.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({bill.taxRate}%)</span>
                  <span className="tabular-nums">{formatCurrency(bill.taxAmount)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(bill.total)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Paid</span>
                <span className="tabular-nums">{formatCurrency(bill.amountPaid)}</span>
              </div>
              {due > 0 && status !== 'Refunded' && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                  <span>Balance Due</span>
                  <span className="tabular-nums">{formatCurrency(due)}</span>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Payment status + method */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-sm font-normal ${meta.cls}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${meta.dotCls}`} />
                {status}
              </Badge>
              {bill.paymentMethod && pmMeta && (
                <Badge variant="outline" className={`text-sm font-normal ${pmMeta.cls}`}>
                  {METHOD_ICON[bill.paymentMethod as PaymentMethod]}
                  {bill.paymentMethod}
                </Badge>
              )}
            </div>
          </div>

          {/* Payment history */}
          {bill.payments.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Payment history</p>
              <div className="space-y-1">
                {bill.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatDateTime(p.createdAt)}</span>
                      <Badge variant="outline" className={`text-[10px] font-normal ${PAYMENT_METHOD_META[p.method as PaymentMethod].cls}`}>
                        {METHOD_ICON[p.method as PaymentMethod]}
                        {p.method}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-normal ${p.type === 'refund' ? 'border-rose-500/40 text-rose-600' : 'border-emerald-500/40 text-emerald-600'}`}>
                        {p.type}
                      </Badge>
                      {p.note && <span className="text-muted-foreground">· {p.note}</span>}
                    </div>
                    <span className={`tabular-nums font-medium ${p.type === 'refund' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {p.type === 'refund' ? '−' : '+'}{formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bill.notes && (
            <div className="mt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{bill.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
            <p>Thank you for choosing Clinic Vault.</p>
            <p className="mt-1">This is a computer-generated invoice.</p>
          </div>
        </CardContent>
      </Card>

      {/* Payment dialog */}
      <Dialog open={showPayment} onOpenChange={(v) => !v && setShowPayment(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {payType === 'refund' ? 'Record refund' : 'Record payment'}
            </DialogTitle>
            <DialogDescription>
              {payType === 'refund'
                ? `Refund from ${bill.billNumber}. This will mark the bill as Refunded.`
                : `Payment for ${bill.billNumber}. Balance due: ${formatCurrency(due)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount ($)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Input
                id="pay-note"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Transaction ID, reference…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPayment(false)} disabled={busy}>Cancel</Button>
            <Button onClick={recordPayment} disabled={busy || !payAmount}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {payType === 'refund' ? 'Record refund' : 'Record payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
