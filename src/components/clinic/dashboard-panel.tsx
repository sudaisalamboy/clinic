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
  Pill,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fmtCurrency, fmtDateTime } from './utils'

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
  recentAppointments: any[]
  lowStockItems: any[]
  expiringItems: any[]
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  delay: number
}

function StatCard({ title, value, icon, color, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">{title}</div>
              <div className="text-2xl font-bold mt-1">{value}</div>
            </div>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function DashboardPanel({ currency = '₹' }: { currency?: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const d = await res.json()
      setData(d)
      setError(false)
    } catch {
      setError(true)
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load dashboard data. <button className="underline" onClick={load}>Retry</button>
        </CardContent>
      </Card>
    )
  }

  const d = data.dashboard
  const chartData = data.dailyRevenue.map((r) => ({
    ...r,
    label: r.date.slice(5),
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard
          title="Today's Appointments"
          value={d.todaysAppointments}
          icon={<CalendarDays className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-50"
          delay={0}
        />
        <StatCard
          title="Today's Revenue"
          value={fmtCurrency(d.todaysRevenue, currency)}
          icon={<Wallet className="h-5 w-5 text-teal-600" />}
          color="bg-teal-50"
          delay={0.05}
        />
        <StatCard
          title="Total Bills"
          value={d.totalBills}
          icon={<Activity className="h-5 w-5 text-sky-600" />}
          color="bg-sky-50"
          delay={0.1}
        />
        <StatCard
          title="Low Stock Alert"
          value={d.lowStockCount}
          icon={<AlertTriangle className="h-5 w-5 text-rose-600" />}
          color="bg-rose-50"
          delay={0.15}
        />
        <StatCard
          title="Expiring Medicines"
          value={d.expiringCount}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          color="bg-amber-50"
          delay={0.2}
        />
        <StatCard
          title="Total Staff"
          value={d.totalStaff}
          icon={<Users className="h-5 w-5 text-violet-600" />}
          color="bg-violet-50"
          delay={0.25}
        />
        <StatCard
          title="Inventory Items"
          value={d.totalInventoryItems}
          icon={<Package className="h-5 w-5 text-indigo-600" />}
          color="bg-indigo-50"
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Revenue</CardTitle>
            <CardDescription>Last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number) => [fmtCurrency(value, currency), 'Revenue']}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Appointments</CardTitle>
            <CardDescription>Latest 10 entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {data.recentAppointments.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">No appointments yet</div>
              ) : (
                data.recentAppointments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border p-2">
                    <div>
                      <div className="text-sm font-medium">{a.patientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(a.date)} • {a.staff?.name || 'No doctor'}
                      </div>
                    </div>
                    <Badge
                      variant={
                        a.status === 'Completed' ? 'default' : a.status === 'Cancelled' ? 'destructive' : 'secondary'
                      }
                    >
                      {a.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-rose-600" />
            Low Stock & Expiring Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-2 text-rose-600">Low Stock</div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {data.lowStockItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">All good!</div>
                ) : (
                  data.lowStockItems.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between text-sm border rounded-md px-2 py-1">
                      <span>{it.name}</span>
                      <Badge variant="destructive">Qty: {it.quantity}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2 text-amber-600">Expiring Soon (30 days)</div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {data.expiringItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">All good!</div>
                ) : (
                  data.expiringItems.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between text-sm border rounded-md px-2 py-1">
                      <span>{it.name}</span>
                      <Badge className="bg-amber-100 text-amber-800">
                        {it.expiryDate ? new Date(it.expiryDate).toLocaleDateString('en-IN') : '—'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
