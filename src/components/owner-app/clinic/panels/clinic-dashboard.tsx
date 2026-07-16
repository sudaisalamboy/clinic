'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  CalendarCheck,
  DollarSign,
  FileWarning,
  UserPlus,
  CalendarPlus,
  ReceiptText,
  TrendingUp,
  PackageX,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useQuickActions } from '../quick-actions-context'
import { formatCurrency, formatRelative, calculateAge } from '../format'

interface DashboardData {
  stats: {
    totalPatients: number
    todaysAppointments: number
    todaysRevenue: number
    pendingBills: number
  }
  chart: { label: string; count: number }[]
  recentPatients: {
    id: string
    patientCode: string
    name: string
    dateOfBirth: string | null
    gender: string | null
    phone: string | null
    createdAt: string
  }[]
  lowStockMedicines: {
    id: string
    name: string
    sku: string | null
    quantity: number
    reorderLevel: number
    price: number
  }[]
}

interface Props {
  onGoTo: (tab: string) => void
  refreshKey: number
}

export function ClinicDashboardPanel({ onGoTo, refreshKey }: Props) {
  const { openAction } = useQuickActions()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      const d: DashboardData = await res.json()
      setData(d)
    } catch {
      // ignore — keep last data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          icon={<UserPlus className="h-4 w-4" />}
          label="Add patient"
          description="Register a new patient"
          onClick={() => openAction('add-patient')}
          accent="emerald"
        />
        <QuickAction
          icon={<CalendarPlus className="h-4 w-4" />}
          label="Book appointment"
          description="Schedule a visit"
          onClick={() => openAction('book-appointment')}
          accent="violet"
        />
        <QuickAction
          icon={<ReceiptText className="h-4 w-4" />}
          label="Generate bill"
          description="Create an itemized bill"
          onClick={() => openAction('generate-bill')}
          accent="amber"
        />
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Total patients"
          value={loading ? '—' : String(data?.stats.totalPatients ?? 0)}
          tone="emerald"
          onClick={() => onGoTo('patients')}
        />
        <StatCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Today's appointments"
          value={loading ? '—' : String(data?.stats.todaysAppointments ?? 0)}
          tone="violet"
          onClick={() => onGoTo('appointments')}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Today's revenue"
          value={loading ? '—' : formatCurrency(data?.stats.todaysRevenue ?? 0)}
          tone="amber"
          onClick={() => onGoTo('bills')}
        />
        <StatCard
          icon={<FileWarning className="h-4 w-4" />}
          label="Pending bills"
          value={loading ? '—' : String(data?.stats.pendingBills ?? 0)}
          tone="rose"
          onClick={() => onGoTo('bills')}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Appointments · last 7 days
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  Daily appointment count, excluding cancelled.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.chart ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                      formatter={(v: number) => [`${v} appointment${v === 1 ? '' : 's'}`, 'Count']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {(data?.chart ?? []).map((entry, i) => {
                        // Highlight today (last bar)
                        const isToday = i === (data?.chart.length ?? 0) - 1
                        return (
                          <Cell
                            key={i}
                            fill={isToday ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.55)'}
                          />
                        )
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low stock medicines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackageX className="h-4 w-4 text-rose-500" />
              Low stock medicines
            </CardTitle>
            <CardDescription className="text-sm">
              Quantity below 10 units.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (data?.lowStockMedicines ?? []).length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground text-center">
                <PackageX className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">All medicines well stocked.</p>
              </div>
            ) : (
              <ScrollArea className="h-[260px] pr-3">
                <div className="space-y-2">
                  {(data?.lowStockMedicines ?? []).map((m) => {
                    const ratio = m.reorderLevel > 0 ? m.quantity / m.reorderLevel : 1
                    const tone =
                      m.quantity <= 0 ? 'rose' : ratio < 0.5 ? 'amber' : 'slate'
                    return (
                      <div key={m.id} className="rounded-md border bg-card p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{m.name}</span>
                          <Badge
                            variant="outline"
                            className={
                              tone === 'rose'
                                ? 'border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-500/5'
                                : tone === 'amber'
                                  ? 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                                  : ''
                            }
                          >
                            {m.quantity} left
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {m.sku ? `SKU ${m.sku} · ` : ''}reorder at {m.reorderLevel}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3"
              onClick={() => onGoTo('inventory')}
            >
              Manage inventory
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent patients */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent patients</CardTitle>
              <CardDescription className="text-sm">Last 5 patient registrations.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onGoTo('patients')}>
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (data?.recentPatients ?? []).length === 0 ? (
            <div className="h-[180px] flex flex-col items-center justify-center text-muted-foreground text-center">
              <Users className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm mb-3">No patients yet.</p>
              <Button size="sm" variant="outline" onClick={() => openAction('add-patient')}>
                <UserPlus className="h-3.5 w-3.5" />
                Add your first patient
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="font-medium px-2 py-2">Name</th>
                    <th className="font-medium px-2 py-2">Age</th>
                    <th className="font-medium px-2 py-2">Gender</th>
                    <th className="font-medium px-2 py-2 hidden sm:table-cell">Phone</th>
                    <th className="font-medium px-2 py-2 text-right">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentPatients ?? []).map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b last:border-0 hover:bg-accent/30 transition"
                    >
                      <td className="px-2 py-2 font-medium">
                        <div>{p.name}</div>
                        <div className="text-xs text-muted-foreground/70 font-mono">{p.patientCode}</div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {calculateAge(p.dateOfBirth) != null ? `${calculateAge(p.dateOfBirth)}y` : '—'}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground capitalize">{p.gender ?? '—'}</td>
                      <td className="px-2 py-2 text-muted-foreground hidden sm:table-cell">{p.phone ?? '—'}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{formatRelative(p.createdAt)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- helpers ----------

const TONES: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400',  border: 'border-violet-500/20' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',    border: 'border-amber-500/20' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400',      border: 'border-rose-500/20' },
  slate:   { bg: 'bg-muted',           text: 'text-muted-foreground',                 border: 'border-border' },
}

function StatCard({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: keyof typeof TONES
  onClick?: () => void
}) {
  const t = TONES[tone]
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border bg-card p-4 hover:bg-accent/30 transition shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${t.bg} ${t.text}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
    </button>
  )
}

function QuickAction({
  icon,
  label,
  description,
  onClick,
  accent,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
  accent: keyof typeof TONES
}) {
  const t = TONES[accent]
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-auto py-3 px-4 justify-start gap-3 hover:bg-accent/40"
    >
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
        {icon}
      </div>
      <div className="text-left">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Button>
  )
}
