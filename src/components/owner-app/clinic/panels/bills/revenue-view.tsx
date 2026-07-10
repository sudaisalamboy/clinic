'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Percent,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '../../format'

interface Bucket {
  label: string
  totalBilled: number
  totalCollected: number
  totalDiscount: number
  totalTax: number
  consultationFees: number
  medicineCharges: number
  labCharges: number
  otherCharges: number
  count: number
  paidCount: number
  pendingCount: number
}

interface Summary {
  totalBilled: number
  totalCollected: number
  totalDiscount: number
  totalTax: number
  totalBills: number
  paidBills: number
  pendingBills: number
  outstanding: number
}

export function RevenueReportView() {
  const { toast } = useToast()
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day')
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bills/revenue?groupby=${groupBy}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setBuckets(data.buckets)
      setSummary(data.summary)
    } catch {
      toast({ title: 'Failed to load revenue report', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [groupBy, toast])

  useEffect(() => { void load() }, [load])

  const collectionRate = summary && summary.totalBilled > 0
    ? Math.round((summary.totalCollected / summary.totalBilled) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Revenue report
        </h3>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md border overflow-hidden">
            <Button
              size="sm"
              variant={groupBy === 'day' ? 'default' : 'ghost'}
              onClick={() => setGroupBy('day')}
              className="rounded-none"
            >
              Daily
            </Button>
            <Button
              size="sm"
              variant={groupBy === 'month' ? 'default' : 'ghost'}
              onClick={() => setGroupBy('month')}
              className="rounded-none"
            >
              Monthly
            </Button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total billed"
            value={formatCurrency(summary.totalBilled)}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            tone="violet"
          />
          <StatCard
            label="Total collected"
            value={formatCurrency(summary.totalCollected)}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            tone="emerald"
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(summary.outstanding)}
            icon={<TrendingDown className="h-3.5 w-3.5" />}
            tone="amber"
          />
          <StatCard
            label="Collection rate"
            value={`${collectionRate}%`}
            icon={<Percent className="h-3.5 w-3.5" />}
            tone="slate"
          />
        </div>
      )}

      {/* Secondary stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Total bills" value={String(summary.totalBills)} />
          <MiniStat label="Paid bills" value={String(summary.paidBills)} tone="emerald" />
          <MiniStat label="Pending/Partial" value={String(summary.pendingBills)} tone="amber" />
          <MiniStat label="Total tax" value={formatCurrency(summary.totalTax)} />
        </div>
      )}

      {/* Chart: Billed vs Collected */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {groupBy === 'day' ? 'Daily' : 'Monthly'} billed vs collected
          </CardTitle>
          <CardDescription className="text-sm">
            Compares total billed amount against amount collected per {groupBy}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : buckets.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No billing data yet.
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) => [formatCurrency(v), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalBilled" name="Billed" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalCollected" name="Collected" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart: Revenue trend (line) */}
      {buckets.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue trend</CardTitle>
            <CardDescription className="text-sm">
              Collected revenue over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), 'Collected']}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalCollected"
                    name="Collected"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown table */}
      {buckets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown</CardTitle>
            <CardDescription className="text-sm">
              Detailed revenue breakdown per {groupBy}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="font-medium px-2 py-2">{groupBy === 'day' ? 'Date' : 'Month'}</th>
                    <th className="font-medium px-2 py-2 text-right">Bills</th>
                    <th className="font-medium px-2 py-2 text-right">Billed</th>
                    <th className="font-medium px-2 py-2 text-right">Collected</th>
                    <th className="font-medium px-2 py-2 text-right">Discount</th>
                    <th className="font-medium px-2 py-2 text-right">Tax</th>
                    <th className="font-medium px-2 py-2 text-right hidden md:table-cell">Consult</th>
                    <th className="font-medium px-2 py-2 text-right hidden md:table-cell">Meds</th>
                    <th className="font-medium px-2 py-2 text-right hidden lg:table-cell">Lab</th>
                    <th className="font-medium px-2 py-2 text-right hidden lg:table-cell">Other</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.slice().reverse().map((b, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      className="border-b last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-2 py-2 font-medium">{b.label}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{b.count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(b.totalBilled)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(b.totalCollected)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(b.totalDiscount)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(b.totalTax)}</td>
                      <td className="px-2 py-2 text-right tabular-nums hidden md:table-cell">{formatCurrency(b.consultationFees)}</td>
                      <td className="px-2 py-2 text-right tabular-nums hidden md:table-cell">{formatCurrency(b.medicineCharges)}</td>
                      <td className="px-2 py-2 text-right tabular-nums hidden lg:table-cell">{formatCurrency(b.labCharges)}</td>
                      <td className="px-2 py-2 text-right tabular-nums hidden lg:table-cell">{formatCurrency(b.otherCharges)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const TONES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400' },
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

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: keyof typeof TONES }) {
  const t = tone ? TONES[tone] : null
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-base font-semibold mt-1 tabular-nums ${t?.text ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
