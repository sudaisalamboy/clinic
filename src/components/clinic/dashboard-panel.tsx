'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock,
  Loader2,
  Package,
  TrendingUp,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtCurrency, fmtDateTime } from './utils'
import { EmptyState } from './empty-state'
import { Skeleton, CardSkeleton, ChartSkeleton } from './skeletons'

interface DashboardData {
  dashboard: {
    todaysAppointments: number
    todaysRevenue: number
    totalBills: number
    lowStockCount: number
    expiringCount: number
    totalStaff: number
    totalInventoryItems: number
  }
  dailyRevenue: { date: string; revenue: number; bills: number }[]
  appointmentStatus?: { status: string; count: number }[]
  recentAppointments: any[]
  lowStockItems: any[]
  expiringItems: any[]
}

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']

export function DashboardPanel({ currency = '₹' }: { currency?: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const d = await res.json()
      setData(d)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <CardSkeleton />
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2"><CardContent className="p-4"><ChartSkeleton /></CardContent></Card>
          <Card><CardContent className="p-4"><Skeleton className="h-56 w-full" /></CardContent></Card>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            variant="error"
            title="Failed to load dashboard"
            description="Something went wrong. Please try again."
            action={<Button onClick={load} size="sm">Retry</Button>}
          />
        </CardContent>
      </Card>
    )
  }

  const d = data.dashboard
  const chartData = data.dailyRevenue.map((r) => ({
    ...r,
    label: r.date.slice(5),
  }))

  const stats = [
    { title: "Today's Appointments", value: d.todaysAppointments, icon: CalendarDays, color: 'emerald', bg: 'bg-emerald-500/10', text: 'text-emerald-600', trend: '+12%', trendUp: true },
    { title: "Today's Revenue", value: fmtCurrency(d.todaysRevenue, currency), icon: Wallet, color: 'teal', bg: 'bg-teal-500/10', text: 'text-teal-600', trend: '+8%', trendUp: true },
    { title: 'Total Bills', value: d.totalBills, icon: Activity, color: 'sky', bg: 'bg-sky-500/10', text: 'text-sky-600', trend: '+5%', trendUp: true },
    { title: 'Low Stock Alert', value: d.lowStockCount, icon: AlertTriangle, color: 'rose', bg: 'bg-rose-500/10', text: 'text-rose-600', trend: d.lowStockCount > 0 ? 'Action needed' : 'All good', trendUp: false },
    { title: 'Expiring Medicines', value: d.expiringCount, icon: Clock, color: 'amber', bg: 'bg-amber-500/10', text: 'text-amber-600', trend: '30 days', trendUp: false },
    { title: 'Total Staff', value: d.totalStaff, icon: Users, color: 'violet', bg: 'bg-violet-500/10', text: 'text-violet-600', trend: 'Active', trendUp: true },
    { title: 'Inventory Items', value: d.totalInventoryItems, icon: Package, color: 'indigo', bg: 'bg-indigo-500/10', text: 'text-indigo-600', trend: 'In stock', trendUp: true },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.15 } }}
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <motion.div
                      className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center`}
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.06 + 0.15, type: 'spring', stiffness: 200 }}
                    >
                      <Icon className={`h-4.5 w-4.5 ${s.text}`} />
                    </motion.div>
                    {s.trend && (
                      <motion.span
                        className={`text-[10px] font-medium flex items-center gap-0.5 ${
                          s.trendUp ? 'text-emerald-600' : 'text-muted-foreground'
                        }`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 + 0.25 }}
                      >
                        {s.trendUp && <ArrowUpRight className="h-3 w-3" />}
                        {s.trend}
                      </motion.span>
                    )}
                  </div>
                  <motion.div
                    className="text-2xl font-bold tracking-tight"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.06 + 0.2 }}
                  >
                    {s.value}
                  </motion.div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.title}</div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-2"
        >
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Revenue Overview</CardTitle>
              <CardDescription className="text-xs">Last 14 days</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              <TrendingUp className="h-3 w-3 mr-1 text-emerald-600" />
              Daily
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${currency}${v}`} />
                  <Tooltip
                    formatter={(value: number) => [fmtCurrency(value, currency), 'Revenue']}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#revGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Appointment status pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
        {data.appointmentStatus && data.appointmentStatus.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Appointment Status</CardTitle>
              <CardDescription className="text-xs">Distribution by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.appointmentStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {data.appointmentStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2">
                {data.appointmentStatus.slice(0, 4).map((s, i) => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {s.status}
                    </span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Bills Overview</CardTitle>
              <CardDescription className="text-xs">Last 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                    <Bar dataKey="bills" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        </motion.div>
      </div>

      {/* Recent appointments + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent appointments */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Appointments</CardTitle>
              <CardDescription className="text-xs">Latest entries</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              View all
              <ChevronRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.recentAppointments.length === 0 ? (
                <EmptyState title="No appointments yet" description="New appointments will show up here" variant="default" />
              ) : (
                data.recentAppointments.slice(0, 6).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/50 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                        {a.patientName?.[0]?.toUpperCase() || 'P'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{a.patientName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.staff?.name || 'No doctor'} · {fmtDateTime(a.date)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-normal shrink-0 ${
                        a.status === 'Completed'
                          ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                          : a.status === 'Cancelled'
                            ? 'border-rose-500/30 text-rose-600 bg-rose-500/5'
                            : a.status === 'No Show'
                              ? 'border-amber-500/30 text-amber-600 bg-amber-500/5'
                              : 'border-sky-500/30 text-sky-600 bg-sky-500/5'
                      }`}
                    >
                      {a.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Alerts */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock Alerts
            </CardTitle>
            <CardDescription className="text-xs">Low stock & expiring items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Low stock */}
              <div>
                <div className="text-xs font-medium text-rose-600 mb-1.5">Low Stock ({data.lowStockItems.length})</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {data.lowStockItems.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 py-2 text-center bg-emerald-50 rounded font-medium"
                    >
                      <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>✓</motion.span>
                      All items well stocked
                    </motion.div>
                  ) : (
                    data.lowStockItems.slice(0, 5).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between text-xs rounded-md border px-2 py-1.5">
                        <span className="font-medium truncate">{it.name}</span>
                        <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 bg-rose-500/5">
                          {it.quantity} left
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Expiring */}
              <div>
                <div className="text-xs font-medium text-amber-600 mb-1.5">Expiring Soon ({data.expiringItems.length})</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {data.expiringItems.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 py-2 text-center bg-emerald-50 rounded font-medium"
                    >
                      <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>✓</motion.span>
                      No items expiring soon
                    </motion.div>
                  ) : (
                    data.expiringItems.slice(0, 5).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between text-xs rounded-md border px-2 py-1.5">
                        <span className="font-medium truncate">{it.name}</span>
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5">
                          {it.expiryDate ? new Date(it.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  )
}
