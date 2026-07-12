'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Download, Loader2, Printer } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { fmtCurrency, fmtDate, toDateInput } from './utils'
import { DatePicker } from './date-picker'

interface ReportData {
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
  appointmentStatus: { status: string; count: number }[]
  recentAppointments: any[]
  lowStockItems: any[]
  expiringItems: any[]
}

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b', '#8b5cf6']

function toCsv(rows: any[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = r[h]
          if (v == null) return ''
          const s = typeof v === 'string' ? v : String(v)
          return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
  }
  return lines.join('\n')
}

function downloadCsv(filename: string, rows: any[]) {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPanel({ currency = '₹' }: { currency?: string }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/reports?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      toast({ title: 'Failed to load reports', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [from, to, toast])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const print = () => window.print()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Reports</CardTitle>
            <CardDescription>Analytics and exportable reports</CardDescription>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <DatePicker value={from} onChange={(v) => setFrom(v.slice(0, 10))} withTime={false} placeholder="From" className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <DatePicker value={to} onChange={(v) => setTo(v.slice(0, 10))} withTime={false} placeholder="To" className="w-40" />
            </div>
            <Button variant="outline" onClick={print}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No data</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Total Revenue (range)</div>
                  <div className="text-xl font-bold mt-1">
                    {fmtCurrency(
                      data.dailyRevenue.reduce((s, r) => s + r.revenue, 0),
                      currency,
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Total Bills (range)</div>
                  <div className="text-xl font-bold mt-1">
                    {data.dailyRevenue.reduce((s, r) => s + r.bills, 0)}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Appointments (range)</div>
                  <div className="text-xl font-bold mt-1">
                    {data.appointmentStatus.reduce((s, r) => s + r.count, 0)}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Inventory Alerts</div>
                  <div className="text-xl font-bold mt-1">
                    {data.dashboard.lowStockCount + data.dashboard.expiringCount}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Daily Revenue</CardTitle>
                  <CardDescription>Revenue trend</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      'daily-revenue.csv',
                      data.dailyRevenue.map((r) => ({ date: r.date, revenue: r.revenue, bills: r.bills })),
                    )
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dailyRevenue.map((r) => ({ ...r, label: r.date.slice(5) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number) => [fmtCurrency(v, currency), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Appointment Status</CardTitle>
                  <CardDescription>Distribution breakdown</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv('appointment-status.csv', data.appointmentStatus)}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.appointmentStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(entry: any) => `${entry.status}: ${entry.count}`}
                      >
                        {data.appointmentStatus.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Low Stock Items</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      'low-stock.csv',
                      data.lowStockItems.map((it) => ({
                        name: it.name,
                        category: it.category?.name || '',
                        quantity: it.quantity,
                        minStock: it.minStock,
                      })),
                    )
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {data.lowStockItems.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">All good!</div>
                  ) : (
                    data.lowStockItems.map((it: any) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-sm border rounded-md px-2 py-1"
                      >
                        <span>{it.name}</span>
                        <span className="text-rose-600">Qty: {it.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Expiring Items</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      'expiring-items.csv',
                      data.expiringItems.map((it) => ({
                        name: it.name,
                        category: it.category?.name || '',
                        expiryDate: it.expiryDate ? fmtDate(it.expiryDate) : '',
                      })),
                    )
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {data.expiringItems.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">All good!</div>
                  ) : (
                    data.expiringItems.map((it: any) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-sm border rounded-md px-2 py-1"
                      >
                        <span>{it.name}</span>
                        <span className="text-amber-600">
                          {it.expiryDate ? fmtDate(it.expiryDate) : '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
