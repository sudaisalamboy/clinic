'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  Download,
  Printer,
  CalendarRange,
  Users,
  Stethoscope,
  DollarSign,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart, Legend, Cell, Pie, PieChart,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, formatDateTime } from '../../format'

interface ReportData {
  from: string
  to: string
  patient: any[]
  doctor: any[]
  financial: {
    daily: any[]
    summary: {
      totalBilled: number
      totalCollected: number
      totalDiscount: number
      totalTax: number
      totalBills: number
      paidBills: number
      pendingBills: number
      byMethod: { Cash: number; Card: number; Online: number }
    }
  }
  appointment: {
    total: number
    byStatus: Record<string, number>
    noShows: any[]
    cancellations: any[]
    daily: any[]
    noShowRate: number
    cancellationRate: number
    completionRate: number
  }
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

export function ReportsPanel() {
  const { toast } = useToast()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?from=${from}&to=${to}`)
      if (!res.ok) throw new Error('load failed')
      const d = await res.json()
      setData(d)
    } catch {
      toast({ title: 'Failed to load reports', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [from, to, toast])

  useEffect(() => { void load() }, [load])

  function setQuickRange(days: number) {
    const t = new Date()
    const f = new Date()
    f.setDate(f.getDate() - (days - 1))
    setFrom(f.toISOString().slice(0, 10))
    setTo(t.toISOString().slice(0, 10))
  }

  // ---- Export helpers ----
  function exportCSV(filename: string, rows: Record<string, any>[]) {
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => {
        const v = r[h]
        if (v === null || v === undefined) return ''
        if (typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g, '""')}"`
        return String(v)
      }).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: `Exported ${filename}` })
  }

  function printReport() {
    window.print()
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Date range + export controls (hidden on print) */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px] h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px] h-8" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setQuickRange(7)}>7d</Button>
                <Button size="sm" variant="outline" onClick={() => setQuickRange(30)}>30d</Button>
                <Button size="sm" variant="outline" onClick={() => setQuickRange(90)}>90d</Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={printReport}>
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="patient">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="patient" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Patients</span>
          </TabsTrigger>
          <TabsTrigger value="doctor" className="gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Doctors</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Financial</span>
          </TabsTrigger>
          <TabsTrigger value="appointment" className="gap-1.5">
            <CalendarCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Appointments</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== PATIENT REPORT ===== */}
        <TabsContent value="patient" className="mt-0 space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="text-base font-semibold">Patient Report</h3>
            <Button size="sm" variant="outline" onClick={() => exportCSV(`patients-${from}-to-${to}.csv`, data.patient)}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="New patients" value={String(data.patient.length)} icon={<Users className="h-3.5 w-3.5" />} tone="violet" />
            <StatCard label="Active" value={String(data.patient.filter((p) => p.status === 'Active').length)} icon={<TrendingUp className="h-3.5 w-3.5" />} tone="emerald" />
            <StatCard label="Inactive" value={String(data.patient.filter((p) => p.status === 'Inactive').length)} icon={<TrendingDown className="h-3.5 w-3.5" />} tone="rose" />
            <StatCard label="Total appointments" value={String(data.patient.reduce((s, p) => s + p.appointments, 0))} icon={<CalendarCheck className="h-3.5 w-3.5" />} tone="amber" />
          </div>
          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="font-medium px-3 py-2">Code</th>
                      <th className="font-medium px-3 py-2">Name</th>
                      <th className="font-medium px-3 py-2 hidden sm:table-cell">Phone</th>
                      <th className="font-medium px-3 py-2 text-center">Appts</th>
                      <th className="font-medium px-3 py-2 text-center hidden md:table-cell">Bills</th>
                      <th className="font-medium px-3 py-2 text-center hidden md:table-cell">Labs</th>
                      <th className="font-medium px-3 py-2 text-center hidden lg:table-cell">Rx</th>
                      <th className="font-medium px-3 py-2">Status</th>
                      <th className="font-medium px-3 py-2 hidden lg:table-cell">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.patient.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No patients in this period.</td></tr>
                    ) : data.patient.map((p, i) => (
                      <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }} className="border-b last:border-0 hover:bg-accent/20">
                        <td className="px-3 py-2 font-mono text-xs">{p.patientCode}</td>
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{p.phone ?? '—'}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{p.appointments}</td>
                        <td className="px-3 py-2 text-center tabular-nums hidden md:table-cell">{p.bills}</td>
                        <td className="px-3 py-2 text-center tabular-nums hidden md:table-cell">{p.labTests}</td>
                        <td className="px-3 py-2 text-center tabular-nums hidden lg:table-cell">{p.prescriptions}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-xs font-normal ${p.status === 'Active' ? 'border-emerald-500/40 text-emerald-600' : 'border-rose-500/40 text-rose-600'}`}>{p.status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(p.createdAt)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DOCTOR PERFORMANCE ===== */}
        <TabsContent value="doctor" className="mt-0 space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="text-base font-semibold">Doctor Performance</h3>
            <Button size="sm" variant="outline" onClick={() => exportCSV(`doctors-${from}-to-${to}.csv`, data.doctor)}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total doctors" value={String(data.doctor.length)} icon={<Stethoscope className="h-3.5 w-3.5" />} tone="violet" />
            <StatCard label="Total appointments" value={String(data.doctor.reduce((s, d) => s + d.totalAppointments, 0))} icon={<CalendarCheck className="h-3.5 w-3.5" />} tone="amber" />
            <StatCard label="Total revenue" value={formatCurrency(data.doctor.reduce((s, d) => s + d.totalCollected, 0))} icon={<DollarSign className="h-3.5 w-3.5" />} tone="emerald" />
            <StatCard label="Avg per doctor" value={formatCurrency(data.doctor.length > 0 ? Math.round(data.doctor.reduce((s, d) => s + d.totalCollected, 0) / data.doctor.length) : 0)} icon={<TrendingUp className="h-3.5 w-3.5" />} tone="slate" />
          </div>
          {/* Revenue chart by doctor */}
          {data.doctor.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Revenue by doctor</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.doctor} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="totalCollected" name="Collected" radius={[0, 4, 4, 0]}>
                        {data.doctor.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="font-medium px-3 py-2">Doctor</th>
                      <th className="font-medium px-3 py-2 hidden md:table-cell">Dept</th>
                      <th className="font-medium px-3 py-2 text-center">Appts</th>
                      <th className="font-medium px-3 py-2 text-center hidden sm:table-cell">Done</th>
                      <th className="font-medium px-3 py-2 text-center hidden sm:table-cell">Cancel</th>
                      <th className="font-medium px-3 py-2 text-center hidden sm:table-cell">NoShow</th>
                      <th className="font-medium px-3 py-2 text-right">Billed</th>
                      <th className="font-medium px-3 py-2 text-right">Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.doctor.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No doctors.</td></tr>
                    ) : data.doctor.map((d, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-accent/20">
                        <td className="px-3 py-2">
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.specialization ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{d.department}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{d.totalAppointments}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-emerald-600 hidden sm:table-cell">{d.completed}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-rose-600 hidden sm:table-cell">{d.cancelled}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-amber-600 hidden sm:table-cell">{d.noShow}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.totalBilled)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(d.totalCollected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== FINANCIAL REPORT ===== */}
        <TabsContent value="financial" className="mt-0 space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="text-base font-semibold">Financial Report</h3>
            <Button size="sm" variant="outline" onClick={() => exportCSV(`financial-${from}-to-${to}.csv`, data.financial.daily)}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total billed" value={formatCurrency(data.financial.summary.totalBilled)} icon={<DollarSign className="h-3.5 w-3.5" />} tone="violet" />
            <StatCard label="Total collected" value={formatCurrency(data.financial.summary.totalCollected)} icon={<TrendingUp className="h-3.5 w-3.5" />} tone="emerald" />
            <StatCard label="Outstanding" value={formatCurrency(data.financial.summary.totalBilled - data.financial.summary.totalCollected)} icon={<TrendingDown className="h-3.5 w-3.5" />} tone="amber" />
            <StatCard label="Total bills" value={String(data.financial.summary.totalBills)} icon={<FileSpreadsheet className="h-3.5 w-3.5" />} tone="slate" />
          </div>
          {/* Billed vs Collected chart */}
          {data.financial.daily.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Billed vs Collected (daily)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.financial.daily} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="billed" name="Billed" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="collected" name="Collected" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Payment method pie */}
          {data.financial.summary.totalCollected > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Payment methods</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: 'Cash', value: data.financial.summary.byMethod.Cash },
                        { name: 'Card', value: data.financial.summary.byMethod.Card },
                        { name: 'Online', value: data.financial.summary.byMethod.Online },
                      ].filter((d) => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name}: ${formatCurrency(e.value)}`} labelLine={false} style={{ fontSize: 11 }}>
                        {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Daily breakdown table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[40vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="font-medium px-3 py-2">Date</th>
                      <th className="font-medium px-3 py-2 text-right">Bills</th>
                      <th className="font-medium px-3 py-2 text-right">Billed</th>
                      <th className="font-medium px-3 py-2 text-right">Collected</th>
                      <th className="font-medium px-3 py-2 text-right hidden sm:table-cell">Discount</th>
                      <th className="font-medium px-3 py-2 text-right hidden sm:table-cell">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.financial.daily.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No bills in this period.</td></tr>
                    ) : data.financial.daily.map((d, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-accent/20">
                        <td className="px-3 py-2">{formatDate(d.date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.billed)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(d.collected)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600 hidden sm:table-cell">{formatCurrency(d.discount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{formatCurrency(d.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== APPOINTMENT REPORT ===== */}
        <TabsContent value="appointment" className="mt-0 space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="text-base font-semibold">Appointment Report</h3>
            <Button size="sm" variant="outline" onClick={() => exportCSV(`appointments-${from}-to-${to}.csv`, data.appointment.daily)}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total" value={String(data.appointment.total)} icon={<CalendarCheck className="h-3.5 w-3.5" />} tone="violet" />
            <StatCard label="Completion rate" value={`${data.appointment.completionRate}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} tone="emerald" />
            <StatCard label="No-show rate" value={`${data.appointment.noShowRate}%`} icon={<TrendingDown className="h-3.5 w-3.5" />} tone="amber" />
            <StatCard label="Cancellation rate" value={`${data.appointment.cancellationRate}%`} icon={<TrendingDown className="h-3.5 w-3.5" />} tone="rose" />
          </div>
          {/* Status breakdown pie */}
          {data.appointment.total > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Status breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={Object.entries(data.appointment.byStatus).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name}: ${e.value}`} labelLine={false} style={{ fontSize: 11 }}>
                        {Object.entries(data.appointment.byStatus).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Daily trend */}
          {data.appointment.daily.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Daily appointment trend</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.appointment.daily} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="completed" name="Completed" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {/* No-shows + cancellations */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                  <TrendingDown className="h-4 w-4" /> No-shows ({data.appointment.noShows.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.appointment.noShows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No no-shows.</p>
                ) : (
                  <ScrollArea className="max-h-[30vh]">
                    <div className="space-y-1">
                      {data.appointment.noShows.map((a) => (
                        <div key={a.id} className="text-xs border rounded p-2">
                          <div className="flex justify-between">
                            <span className="font-medium">{a.patient.name}</span>
                            <span className="text-muted-foreground">{formatDateTime(a.scheduledAt)}</span>
                          </div>
                          {a.doctor && <div className="text-muted-foreground">Dr. {a.doctor.name}</div>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-rose-600">
                  <TrendingDown className="h-4 w-4" /> Cancellations ({data.appointment.cancellations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.appointment.cancellations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No cancellations.</p>
                ) : (
                  <ScrollArea className="max-h-[30vh]">
                    <div className="space-y-1">
                      {data.appointment.cancellations.map((a) => (
                        <div key={a.id} className="text-xs border rounded p-2">
                          <div className="flex justify-between">
                            <span className="font-medium">{a.patient.name}</span>
                            <span className="text-muted-foreground">{formatDateTime(a.scheduledAt)}</span>
                          </div>
                          {a.doctor && <div className="text-muted-foreground">Dr. {a.doctor.name}</div>}
                          {a.reason && <div className="text-muted-foreground/70 italic">{a.reason}</div>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Print header (only visible on print) */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Clinic Vault — Report</h1>
        <p className="text-sm text-muted-foreground">{formatDate(from)} to {formatDate(to)}</p>
        <p className="text-xs text-muted-foreground">Generated {formatDateTime(new Date().toISOString())}</p>
      </div>
    </div>
  )
}

const TONES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
  slate: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: keyof typeof TONES }) {
  const t = TONES[tone]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${t.bg} ${t.text}`}>{icon}</div>
        </div>
        <div className="text-lg font-semibold mt-1.5 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
