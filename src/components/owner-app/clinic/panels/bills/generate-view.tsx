'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Loader2,
  ReceiptText,
  Search,
  User,
  Stethoscope,
  Plus,
  Trash2,
  Pill,
  FlaskConical,
  Package,
  Percent,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, calculateAge } from '../../format'
import { computeBillTotals, type PaymentMethod } from './bill-helpers'
import type { LineItem } from '@/lib/bill-calc'

interface PatientOption {
  id: string
  name: string
  phone: string | null
  patientCode: string
  dateOfBirth: string | null
}
interface DoctorOption {
  id: string
  name: string
  specialization: string | null
  consultationFee: number
  department?: { name: string } | null
}
interface MedicineOption {
  id: string
  name: string
  price: number
  quantity: number
}

interface Props {
  patients: PatientOption[]
  doctors: DoctorOption[]
  medicines: MedicineOption[]
  onBack: () => void
  onGenerated: (id: string) => void
}

export function GenerateBillView({ patients, doctors, medicines, onBack, onGenerated }: Props) {
  const { toast } = useToast()
  const [patientQuery, setPatientQuery] = useState('')
  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [consultationFee, setConsultationFee] = useState('0')
  const [items, setItems] = useState<LineItem[]>([])
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed')
  const [discountValue, setDiscountValue] = useState('0')
  const [taxRate, setTaxRate] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [initialPayment, setInitialPayment] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-fill consultation fee from doctor
  useEffect(() => {
    if (!doctorId) return
    const doc = doctors.find((d) => d.id === doctorId)
    if (doc) {
      setConsultationFee(String(doc.consultationFee))
    }
  }, [doctorId, doctors])

  // Close patient dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Filtered patients
  const filteredPatients = patients.filter((p) => {
    if (!patientQuery.trim()) return true
    const q = patientQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q) ||
      p.patientCode.toLowerCase().includes(q)
    )
  }).slice(0, 20)

  const selectedPatient = patients.find((p) => p.id === patientId)
  const selectedDoctor = doctors.find((d) => d.id === doctorId)

  // Live totals
  const totals = useMemo(() => computeBillTotals({
    consultationFee: parseFloat(consultationFee) || 0,
    items,
    discountType,
    discountValue: parseFloat(discountValue) || 0,
    taxRate: parseFloat(taxRate) || 0,
  }), [consultationFee, items, discountType, discountValue, taxRate])

  function selectPatient(p: PatientOption) {
    setPatientId(p.id)
    setPatientQuery(`${p.name} · ${p.patientCode}`)
    setShowPatientDropdown(false)
  }

  function addLineItem(category: LineItem['category']) {
    setItems((prev) => [...prev, { category, name: '', qty: 1, price: 0 }])
  }

  function updateLineItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }

  function removeLineItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addMedicine(medId: string) {
    const med = medicines.find((m) => m.id === medId)
    if (!med) return
    setItems((prev) => [...prev, { category: 'medicine', name: med.name, qty: 1, price: med.price }])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Please select a patient')
      return
    }
    // Validate line items have names
    const cleanedItems = items.filter((it) => it.name.trim() && it.qty > 0)
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        patientId,
        doctorId: doctorId || null,
        consultationFee: parseFloat(consultationFee) || 0,
        items: cleanedItems,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        taxRate: parseFloat(taxRate) || 0,
        paymentMethod,
        notes: notes.trim() || null,
      }
      const initPay = parseFloat(initialPayment)
      if (initPay > 0) {
        body.initialPayment = { amount: initPay, method: paymentMethod }
      }
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate bill')
      toast({
        title: 'Bill generated',
        description: `${data.bill.billNumber} · ${formatCurrency(data.bill.total)}`,
      })
      onGenerated(data.bill.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate bill')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ReceiptText className="h-4 w-4" />
              Generate bill
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Bill number is auto-generated. Total is calculated from charges, discount, and tax.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6 max-w-3xl">
          {/* Patient + doctor */}
          <section className="grid sm:grid-cols-2 gap-4">
            {/* Patient search */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Patient
              </h3>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patient…"
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value)
                      setPatientId('')
                      setShowPatientDropdown(true)
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
                <AnimatePresence>
                  {showPatientDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto"
                    >
                      {filteredPatients.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">No patients found.</div>
                      ) : (
                        filteredPatients.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectPatient(p)}
                            className="w-full text-left px-3 py-2 hover:bg-accent/40 transition border-b last:border-0"
                          >
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.patientCode}{p.phone ? ` · ${p.phone}` : ''}{p.dateOfBirth ? ` · ${calculateAge(p.dateOfBirth)}y` : ''}
                            </p>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {selectedPatient && (
                <div className="rounded-md border bg-emerald-500/5 border-emerald-500/20 p-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">{selectedPatient.name}</span>
                  <span className="text-xs text-muted-foreground">{selectedPatient.patientCode}</span>
                </div>
              )}
            </div>
            {/* Doctor */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" /> Doctor (optional)
              </h3>
              <Select value={doctorId || 'none'} onValueChange={(v) => setDoctorId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No doctor —</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{d.specialization ? ` · ${d.specialization}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1.5">
                <Label htmlFor="consultationFee" className="text-xs flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Consultation fee ($)
                </Label>
                <Input
                  id="consultationFee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                />
                {selectedDoctor && (
                  <p className="text-xs text-muted-foreground">
                    Auto-filled from doctor's fee ({formatCurrency(selectedDoctor.consultationFee)})
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Line items */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Charges</h3>
              <div className="flex gap-1">
                {medicines.length > 0 && (
                  <Select onValueChange={addMedicine}>
                    <SelectTrigger className="h-7 w-[160px] text-xs">
                      <SelectValue placeholder="+ Medicine" />
                    </SelectTrigger>
                    <SelectContent>
                      {medicines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.quantity}) — {formatCurrency(m.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[28px_1fr_60px_90px_28px] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                <div></div>
                <div>Name</div>
                <div>Qty</div>
                <div>Price ($)</div>
                <div></div>
              </div>
              {items.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No charges added yet. Use the buttons below to add line items.
                </div>
              ) : (
                items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[28px_1fr_60px_90px_28px] gap-2 px-3 py-2 items-center border-t">
                    <div className="flex justify-center">
                      {it.category === 'medicine' && <Pill className="h-3.5 w-3.5 text-violet-500" />}
                      {it.category === 'lab' && <FlaskConical className="h-3.5 w-3.5 text-sky-500" />}
                      {it.category === 'other' && <Package className="h-3.5 w-3.5 text-amber-500" />}
                    </div>
                    <Input
                      placeholder="Item name"
                      value={it.name}
                      onChange={(e) => updateLineItem(i, { name: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => updateLineItem(i, { qty: parseInt(e.target.value || '1', 10) })}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.price}
                      onChange={(e) => updateLineItem(i, { price: parseFloat(e.target.value || '0') })}
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeLineItem(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addLineItem('medicine')}>
                <Pill className="h-3.5 w-3.5" /> Medicine
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addLineItem('lab')}>
                <FlaskConical className="h-3.5 w-3.5" /> Lab
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addLineItem('other')}>
                <Package className="h-3.5 w-3.5" /> Other
              </Button>
            </div>
          </section>

          {/* Discount + tax + payment */}
          <section className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" /> Discount
              </h3>
              <div className="flex gap-2">
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" /> Tax rate (%)
              </h3>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
              />
            </div>
          </section>

          <section className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment method</h3>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Initial payment ($)</h3>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                placeholder="0.00 (optional)"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to mark bill as Pending. Enter an amount to record a partial/full payment.
              </p>
            </div>
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this bill…"
            />
          </div>

          {/* Live total summary */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consultation</span>
              <span className="tabular-nums">{formatCurrency(totals.consultationFee)}</span>
            </div>
            {totals.medicineCharges > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medicines</span>
                <span className="tabular-nums">{formatCurrency(totals.medicineCharges)}</span>
              </div>
            )}
            {totals.labCharges > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lab</span>
                <span className="tabular-nums">{formatCurrency(totals.labCharges)}</span>
              </div>
            )}
            {totals.otherCharges > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Other</span>
                <span className="tabular-nums">{formatCurrency(totals.otherCharges)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount {discountType === 'percent' ? `(${discountValue}%)` : ''}</span>
                <span className="tabular-nums">−{formatCurrency(totals.discountAmount)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span className="tabular-nums">{formatCurrency(totals.taxAmount)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !patientId}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Generate bill
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
