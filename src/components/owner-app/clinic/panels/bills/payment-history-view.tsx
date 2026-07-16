'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  Banknote,
  CreditCard,
  Globe,
  TrendingUp,
  TrendingDown,
  Receipt,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { formatCurrency, formatDateTime } from '../../format'
import { PAYMENT_METHODS, type PaymentMethod, PAYMENT_METHOD_META } from './bill-helpers'

interface PaymentRow {
  id: string
  amount: number
  method: PaymentMethod
  type: 'payment' | 'refund'
  note: string | null
  createdAt: string
  bill: {
    id: string
    billNumber: string
    total: number
    status: string
    patient: { id: string; name: string; patientCode: string }
  }
}

interface Summary {
  totalCollected: number
  totalRefunded: number
  count: number
  byMethod: Record<PaymentMethod, number>
}

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  Cash: <Banknote className="h-3.5 w-3.5" />,
  Card: <CreditCard className="h-3.5 w-3.5" />,
  Online: <Globe className="h-3.5 w-3.5" />,
}

interface Props {
  onOpenBill?: (id: string) => void
}

export function PaymentHistoryView({ onOpenBill }: Props) {
  const { toast } = useToast()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [methodFilter, setMethodFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (methodFilter !== 'all') params.set('method', methodFilter)
      const res = await fetch(`/api/payments?${params.toString()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPayments(data.payments)
      setSummary(data.summary)
    } catch {
      toast({ title: 'Failed to load payments', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [methodFilter, toast])

  useEffect(() => { void load() }, [load])

  const chartData = summary
    ? PAYMENT_METHODS.map((m) => ({ name: m, amount: summary.byMethod[m] ?? 0 }))
    : []

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total collected"
          value={summary ? formatCurrency(summary.totalCollected) : '—'}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          tone="emerald"
        />
        <StatCard
          label="Total refunded"
          value={summary ? formatCurrency(summary.totalRefunded) : '—'}
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          tone="rose"
        />
        <StatCard
          label="Net revenue"
          value={summary ? formatCurrency(summary.totalCollected - summary.totalRefunded) : '—'}
          icon={<Receipt className="h-3.5 w-3.5" />}
          tone="violet"
        />
        <StatCard
          label="Transactions"
          value={summary ? String(summary.count) : '—'}
          icon={<CreditCard className="h-3.5 w-3.5" />}
          tone="slate"
        />
      </div>

      {/* By-method chart */}
      {summary && summary.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By payment method</CardTitle>
            <CardDescription className="text-sm">Total collected per method.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), 'Collected']}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    <Cell fill="hsl(var(--chart-1))" />
                    <Cell fill="hsl(var(--chart-2))" />
                    <Cell fill="hsl(var(--chart-3))" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              Payment log
              <Badge variant="secondary" className="font-normal">{payments.length}</Badge>
            </CardTitle>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Banknote className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No payments recorded yet.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-1">
                {payments.map((p, i) => {
                  const isRefund = p.type === 'refund'
                  const pmMeta = PAYMENT_METHOD_META[p.method]
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      onClick={() => onOpenBill?.(p.bill.id)}
                      className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-md border transition hover:bg-accent/30 ${
                        isRefund ? 'bg-rose-500/5 border-rose-500/20' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${pmMeta.cls}`}>
                          {METHOD_ICON[p.method]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{p.bill.billNumber}</span>
                            <span className="text-sm font-medium truncate">{p.bill.patient.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(p.createdAt)}
                            {p.note ? ` · ${p.note}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-semibold tabular-nums ${isRefund ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {isRefund ? '−' : '+'}{formatCurrency(p.amount)}
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-normal ${isRefund ? 'border-rose-500/40 text-rose-600' : 'border-emerald-500/40 text-emerald-600'}`}>
                          {p.type}
                        </Badge>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const TONES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400' },
  slate:   { bg: 'bg-muted',           text: 'text-muted-foreground' },
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: keyof typeof TONES
}) {
  const t = TONES[tone]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${t.bg} ${t.text}`}>
            {icon}
          </div>
        </div>
        <div className="text-lg font-semibold mt-1.5 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
