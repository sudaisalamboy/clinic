'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Search,
  User,
  Stethoscope,
  Plus,
  Trash2,
  Pill,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
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
import { calculateAge } from '../../format'
import type { PrescribedMedicine } from './prescription-helpers'

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
  department?: { name: string } | null
}
interface MedicineOption {
  id: string
  name: string
  genericName: string | null
  quantity: number
}

interface Props {
  patients: PatientOption[]
  doctors: DoctorOption[]
  medicines: MedicineOption[]
  onBack: () => void
  onCreated: (id: string) => void
}

export function CreatePrescriptionView({ patients, doctors, medicines, onBack, onCreated }: Props) {
  const { toast } = useToast()
  const [patientQuery, setPatientQuery] = useState('')
  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10))
  // Medical record fields
  const [symptoms, setSymptoms] = useState('')
  const [temperature, setTemperature] = useState('')
  const [bloodPressure, setBloodPressure] = useState('')
  const [pulse, setPulse] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  // Prescription fields
  const [medicines_, setMedicines] = useState<PrescribedMedicine[]>([
    { name: '', dosage: '', frequency: '', duration: '', instructions: '' },
  ])
  const [advice, setAdvice] = useState('')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

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

  function addMedicineRow() {
    setMedicines((prev) => [...prev, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  }
  function updateMedicineRow(i: number, patch: Partial<PrescribedMedicine>) {
    setMedicines((prev) => prev.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  }
  function removeMedicineRow(i: number) {
    setMedicines((prev) => prev.filter((_, idx) => idx !== i))
  }
  function addMedicineFromInventory(medId: string) {
    const med = medicines.find((m) => m.id === medId)
    if (!med) return
    setMedicines((prev) => [...prev, {
      medicineId: med.id,
      name: med.name,
      dosage: '',
      frequency: '',
      duration: '',
      instructions: '',
    }])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Please select a patient')
      return
    }
    const cleanedMeds = medicines_.filter((m) => m.name.trim())
    if (cleanedMeds.length === 0) {
      setError('Add at least one medicine')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId: doctorId || null,
          visitDate,
          symptoms: symptoms.trim() || null,
          temperature: temperature.trim() || null,
          bloodPressure: bloodPressure.trim() || null,
          pulse: pulse.trim() || null,
          weight: weight.trim() || null,
          height: height.trim() || null,
          diagnosis: diagnosis.trim() || null,
          notes: notes.trim() || null,
          medicines: cleanedMeds,
          advice: advice.trim() || null,
          nextVisitDate: nextVisitDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create prescription')
      toast({
        title: 'Prescription created',
        description: data.prescription.prescriptionNumber,
      })
      onCreated(data.prescription.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prescription')
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
              <FileText className="h-4 w-4" />
              Create prescription
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Medical record + prescribed medicines. Stock auto-decrements on save.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6 max-w-3xl">
          {/* Patient + doctor + date */}
          <section className="grid sm:grid-cols-2 gap-4">
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
                            onClick={() => {
                              setPatientId(p.id)
                              setPatientQuery(`${p.name} · ${p.patientCode}`)
                              setShowPatientDropdown(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent/40 transition border-b last:border-0"
                          >
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.patientCode}{p.phone ? ` · ${p.phone}` : ''}
                              {p.dateOfBirth ? ` · ${calculateAge(p.dateOfBirth)}y` : ''}
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
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" /> Doctor
              </h3>
              <Select value={doctorId || 'none'} onValueChange={(v) => setDoctorId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
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
                <Label htmlFor="visit-date" className="text-xs">Visit date</Label>
                <Input
                  id="visit-date"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Medical record: symptoms + vitals + diagnosis */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Medical record</h3>
            <div className="space-y-1.5">
              <Label htmlFor="symptoms">Symptoms / chief complaint</Label>
              <Textarea
                id="symptoms"
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Fever for 3 days, headache, body pain…"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="temp" className="text-xs">Temp (°F)</Label>
                <Input id="temp" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="98.6" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bp" className="text-xs">BP</Label>
                <Input id="bp" value={bloodPressure} onChange={(e) => setBloodPressure(e.target.value)} placeholder="120/80" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pulse" className="text-xs">Pulse</Label>
                <Input id="pulse" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="72 bpm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weight" className="text-xs">Weight</Label>
                <Input id="weight" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70 kg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="height" className="text-xs">Height</Label>
                <Input id="height" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170 cm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Textarea
                id="diagnosis"
                rows={2}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Working diagnosis…"
              />
            </div>
          </section>

          {/* Medicines */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5" /> Prescribed medicines
              </h3>
              {medicines.length > 0 && (
                <Select onValueChange={addMedicineFromInventory}>
                  <SelectTrigger className="h-7 w-[180px] text-xs">
                    <SelectValue placeholder="+ From inventory" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              {medicines_.map((m, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Medicine {i + 1}</span>
                    {medicines_.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeMedicineRow(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Medicine name"
                    value={m.name}
                    onChange={(e) => updateMedicineRow(i, { name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Dosage</Label>
                      <Input
                        placeholder="1 tablet"
                        value={m.dosage}
                        onChange={(e) => updateMedicineRow(i, { dosage: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Frequency</Label>
                      <Input
                        placeholder="3x daily"
                        value={m.frequency}
                        onChange={(e) => updateMedicineRow(i, { frequency: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Duration</Label>
                      <Input
                        placeholder="5 days"
                        value={m.duration}
                        onChange={(e) => updateMedicineRow(i, { duration: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <Input
                    placeholder="Instructions (e.g. after meals)"
                    value={m.instructions ?? ''}
                    onChange={(e) => updateMedicineRow(i, { instructions: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addMedicineRow} className="w-full">
              <Plus className="h-3.5 w-3.5" />
              Add medicine
            </Button>
          </section>

          {/* Advice + next visit */}
          <section className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="advice">Advice / special instructions</Label>
              <Textarea
                id="advice"
                rows={3}
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                placeholder="Rest, drink plenty of fluids, avoid cold drinks…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next-visit" className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Next visit date
              </Label>
              <Input
                id="next-visit"
                type="date"
                value={nextVisitDate}
                onChange={(e) => setNextVisitDate(e.target.value)}
              />
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Examination notes (optional)…"
                className="mt-2"
              />
            </div>
          </section>

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
              Create prescription
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
