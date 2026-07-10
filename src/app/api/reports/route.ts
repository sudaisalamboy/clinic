import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

/// Returns all 4 report types in one call, filtered by date range.
/// ?from=YYYY-MM-DD & ?to=YYYY-MM-DD (defaults to last 30 days)
export async function GET(req: NextRequest) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  const now = new Date()
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 29)
  defaultFrom.setHours(0, 0, 0, 0)

  const from = fromParam ? new Date(fromParam) : defaultFrom
  const to = toParam ? new Date(toParam) : now
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }
  // Include the entire end day
  const toEnd = new Date(to)
  toEnd.setHours(23, 59, 59, 999)

  // ---- 1. Patient Report ----
  const patients = await db.patient.findMany({
    where: { createdAt: { gte: from, lte: toEnd } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { appointments: true, bills: true, labTests: true, prescriptions: true } },
    },
  })
  const patientReport = patients.map((p) => ({
    patientCode: p.patientCode,
    name: p.name,
    gender: p.gender,
    phone: p.phone,
    dateOfBirth: p.dateOfBirth,
    status: p.status,
    createdAt: p.createdAt,
    appointments: p._count.appointments,
    bills: p._count.bills,
    labTests: p._count.labTests,
    prescriptions: p._count.prescriptions,
  }))

  // ---- 2. Doctor Performance ----
  const doctors = await db.doctor.findMany({
    include: {
      appointments: {
        where: { scheduledAt: { gte: from, lte: toEnd } },
        select: { id: true, status: true, fee: true },
      },
      bills: {
        where: { createdAt: { gte: from, lte: toEnd } },
        select: { total: true, amountPaid: true, status: true },
      },
      department: { select: { name: true } },
    },
  })
  const doctorReport = doctors.map((d) => {
    const appts = d.appointments
    const completed = appts.filter((a) => a.status === 'Completed').length
    const cancelled = appts.filter((a) => a.status === 'Cancelled').length
    const noShow = appts.filter((a) => a.status === 'No Show').length
    const revenue = d.bills.reduce((s, b) => s + b.amountPaid, 0)
    const billed = d.bills.reduce((s, b) => s + b.total, 0)
    return {
      doctorCode: d.doctorCode,
      name: d.name,
      specialization: d.specialization,
      department: d.department?.name ?? '—',
      status: d.status,
      totalAppointments: appts.length,
      completed,
      cancelled,
      noShow,
      totalBilled: Math.round(billed * 100) / 100,
      totalCollected: Math.round(revenue * 100) / 100,
      consultationFee: d.consultationFee,
    }
  })

  // ---- 3. Financial Report ----
  const bills = await db.bill.findMany({
    where: { createdAt: { gte: from, lte: toEnd } },
    select: {
      total: true,
      amountPaid: true,
      discountAmount: true,
      taxAmount: true,
      consultationFee: true,
      medicineCharges: true,
      labCharges: true,
      otherCharges: true,
      status: true,
      createdAt: true,
      paymentMethod: true,
    },
  })
  // Group by day
  const finByDay = new Map<string, {
    date: string
    billed: number
    collected: number
    discount: number
    tax: number
    count: number
    paid: number
    pending: number
  }>()
  for (const b of bills) {
    const d = new Date(b.createdAt)
    const key = d.toISOString().slice(0, 10)
    if (!finByDay.has(key)) {
      finByDay.set(key, { date: key, billed: 0, collected: 0, discount: 0, tax: 0, count: 0, paid: 0, pending: 0 })
    }
    const row = finByDay.get(key)!
    row.billed += b.total
    row.collected += b.amountPaid
    row.discount += b.discountAmount
    row.tax += b.taxAmount
    row.count += 1
    if (b.status === 'Paid') row.paid += 1
    if (b.status === 'Pending' || b.status === 'Partial') row.pending += 1
  }
  const financialReport = {
    daily: Array.from(finByDay.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        ...r,
        billed: Math.round(r.billed * 100) / 100,
        collected: Math.round(r.collected * 100) / 100,
        discount: Math.round(r.discount * 100) / 100,
        tax: Math.round(r.tax * 100) / 100,
      })),
    summary: {
      totalBilled: Math.round(bills.reduce((s, b) => s + b.total, 0) * 100) / 100,
      totalCollected: Math.round(bills.reduce((s, b) => s + b.amountPaid, 0) * 100) / 100,
      totalDiscount: Math.round(bills.reduce((s, b) => s + b.discountAmount, 0) * 100) / 100,
      totalTax: Math.round(bills.reduce((s, b) => s + b.taxAmount, 0) * 100) / 100,
      totalBills: bills.length,
      paidBills: bills.filter((b) => b.status === 'Paid').length,
      pendingBills: bills.filter((b) => b.status === 'Pending' || b.status === 'Partial').length,
      byMethod: {
        Cash: Math.round(bills.filter((b) => b.paymentMethod === 'Cash').reduce((s, b) => s + b.amountPaid, 0) * 100) / 100,
        Card: Math.round(bills.filter((b) => b.paymentMethod === 'Card').reduce((s, b) => s + b.amountPaid, 0) * 100) / 100,
        Online: Math.round(bills.filter((b) => b.paymentMethod === 'Online').reduce((s, b) => s + b.amountPaid, 0) * 100) / 100,
      },
    },
  }

  // ---- 4. Appointment Report ----
  const appointments = await db.appointment.findMany({
    where: { scheduledAt: { gte: from, lte: toEnd } },
    include: {
      patient: { select: { name: true, patientCode: true } },
      doctor: { select: { name: true } },
    },
  })
  const apptByStatus: Record<string, number> = {}
  for (const a of appointments) {
    apptByStatus[a.status] = (apptByStatus[a.status] ?? 0) + 1
  }
  // Group by day
  const apptByDay = new Map<string, { date: string; total: number; completed: number; cancelled: number; noShow: number; pending: number }>()
  for (const a of appointments) {
    const d = new Date(a.scheduledAt)
    const key = d.toISOString().slice(0, 10)
    if (!apptByDay.has(key)) {
      apptByDay.set(key, { date: key, total: 0, completed: 0, cancelled: 0, noShow: 0, pending: 0 })
    }
    const row = apptByDay.get(key)!
    row.total += 1
    if (a.status === 'Completed') row.completed += 1
    if (a.status === 'Cancelled') row.cancelled += 1
    if (a.status === 'No Show') row.noShow += 1
    if (a.status === 'Scheduled' || a.status === 'Confirmed' || a.status === 'Checked-In') row.pending += 1
  }
  const appointmentReport = {
    total: appointments.length,
    byStatus: apptByStatus,
    noShows: appointments.filter((a) => a.status === 'No Show'),
    cancellations: appointments.filter((a) => a.status === 'Cancelled'),
    daily: Array.from(apptByDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    noShowRate: appointments.length > 0
      ? Math.round((appointments.filter((a) => a.status === 'No Show').length / appointments.length) * 100)
      : 0,
    cancellationRate: appointments.length > 0
      ? Math.round((appointments.filter((a) => a.status === 'Cancelled').length / appointments.length) * 100)
      : 0,
    completionRate: appointments.length > 0
      ? Math.round((appointments.filter((a) => a.status === 'Completed').length / appointments.length) * 100)
      : 0,
  }

  return NextResponse.json({
    from: from.toISOString(),
    to: toEnd.toISOString(),
    patient: patientReport,
    doctor: doctorReport,
    financial: financialReport,
    appointment: appointmentReport,
  })
}
