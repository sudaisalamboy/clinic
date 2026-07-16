'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Printer,
  Loader2,
  Pill,
  CalendarClock,
  Stethoscope,
  User,
  Heart,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime, formatDate, calculateAge } from '../../format'
import type { PrescriptionDetail } from './prescription-helpers'

interface Props {
  prescriptionId: string
  onBack: () => void
}

export function PrescriptionDetailsView({ prescriptionId, onBack }: Props) {
  const { toast } = useToast()
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/prescriptions/${prescriptionId}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPrescription(data.prescription)
    } catch {
      toast({ title: 'Failed to load prescription', variant: 'destructive' })
      onBack()
    } finally {
      setLoading(false)
    }
  }, [prescriptionId, toast, onBack])

  useEffect(() => { void load() }, [load])

  if (loading || !prescription) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const mr = prescription.medicalRecord
  const nextVisit = prescription.nextVisitDate ? new Date(prescription.nextVisitDate) : null
  const isUpcoming = nextVisit && nextVisit.getTime() > Date.now()

  return (
    <div className="space-y-4">
      {/* Action bar (not printed) */}
      <Card className="print:hidden">
        <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-sm">{prescription.prescriptionNumber}</span>
            {isUpcoming && (
              <Badge variant="outline" className="text-xs font-normal border-violet-500/40 text-violet-600 dark:text-violet-400">
                <CalendarClock className="h-3 w-3" />
                Follow-up {formatDate(prescription.nextVisitDate!)}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Print prescription
          </Button>
        </CardContent>
      </Card>

      {/* Printable prescription */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-6 sm:p-8 print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Clinic Vault</h1>
              <p className="text-xs text-muted-foreground mt-1">Medical Prescription</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold">{prescription.prescriptionNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatDateTime(prescription.createdAt)}</p>
            </div>
          </div>

          {/* Patient + doctor grid */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <User className="h-3 w-3" /> Patient
              </p>
              <p className="font-medium">{prescription.patient.name}</p>
              <p className="text-xs text-muted-foreground">{prescription.patient.patientCode}</p>
              <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                {prescription.patient.dateOfBirth && (
                  <p>DOB: {formatDate(prescription.patient.dateOfBirth)}
                    {calculateAge(prescription.patient.dateOfBirth) != null ? ` (${calculateAge(prescription.patient.dateOfBirth)}y)` : ''}
                  </p>
                )}
                {prescription.patient.gender && <p className="capitalize">{prescription.patient.gender}</p>}
                {prescription.patient.bloodGroup && <p>Blood: {prescription.patient.bloodGroup}</p>}
                {prescription.patient.phone && <p>{prescription.patient.phone}</p>}
              </div>
            </div>
            <div className="sm:text-right">
              {prescription.doctor && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1 sm:justify-end">
                    <Stethoscope className="h-3 w-3" /> Doctor
                  </p>
                  <p className="font-medium">{prescription.doctor.name}</p>
                  {prescription.doctor.specialization && <p className="text-xs text-muted-foreground">{prescription.doctor.specialization}</p>}
                  {prescription.doctor.department && <p className="text-xs text-muted-foreground">{prescription.doctor.department.name}</p>}
                </>
              )}
              <p className="text-xs text-muted-foreground mt-2">Visit: {formatDate(mr.visitDate)}</p>
            </div>
          </div>

          <Separator className="my-3" />

          {/* Vitals */}
          {(mr.temperature || mr.bloodPressure || mr.pulse || mr.weight || mr.height) && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Heart className="h-3 w-3" /> Vitals
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {mr.temperature && <div><span className="text-muted-foreground">Temp:</span> {mr.temperature}°F</div>}
                {mr.bloodPressure && <div><span className="text-muted-foreground">BP:</span> {mr.bloodPressure}</div>}
                {mr.pulse && <div><span className="text-muted-foreground">Pulse:</span> {mr.pulse}</div>}
                {mr.weight && <div><span className="text-muted-foreground">Weight:</span> {mr.weight}</div>}
                {mr.height && <div><span className="text-muted-foreground">Height:</span> {mr.height}</div>}
              </div>
            </div>
          )}

          {/* Symptoms + diagnosis */}
          {(mr.symptoms || mr.diagnosis) && (
            <div className="mb-4 space-y-2">
              {mr.symptoms && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Symptoms</p>
                  <p className="text-sm">{mr.symptoms}</p>
                </div>
              )}
              {mr.diagnosis && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Diagnosis</p>
                  <p className="text-sm font-medium">{mr.diagnosis}</p>
                </div>
              )}
            </div>
          )}

          <Separator className="my-3" />

          {/* Medicines (the Rx) */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Pill className="h-3 w-3" /> Rx — Prescribed medicines
            </p>
            <div className="space-y-2">
              {prescription.medicines.map((m, i) => (
                <div key={i} className="rounded-md border p-2.5 bg-card">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                        {m.dosage && <span><span className="font-medium text-foreground">Dosage:</span> {m.dosage}</span>}
                        {m.frequency && <span><span className="font-medium text-foreground">Frequency:</span> {m.frequency}</span>}
                        {m.duration && <span><span className="font-medium text-foreground">Duration:</span> {m.duration}</span>}
                      </div>
                      {m.instructions && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">{m.instructions}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advice */}
          {prescription.advice && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Advice / special instructions</p>
              <p className="text-sm whitespace-pre-wrap">{prescription.advice}</p>
            </div>
          )}

          {/* Next visit */}
          {nextVisit && (
            <div className="mb-4 rounded-md border border-violet-500/30 bg-violet-500/5 p-3">
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Next visit
              </p>
              <p className="text-sm font-medium">{formatDate(prescription.nextVisitDate!)}</p>
            </div>
          )}

          {/* Notes */}
          {mr.notes && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{mr.notes}</p>
            </div>
          )}

          {/* Footer with signatures */}
          <div className="mt-12 pt-4 border-t flex justify-between items-end">
            <div>
              <p className="text-xs text-muted-foreground">Patient signature</p>
              <div className="w-32 border-b border-muted-foreground/30 mt-6" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Doctor's signature</p>
              <div className="w-40 border-b border-muted-foreground/30 mt-6" />
              {prescription.doctor && (
                <p className="text-xs font-medium mt-1">{prescription.doctor.name}</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t text-center text-[10px] text-muted-foreground">
            <p>This is a computer-generated prescription from Clinic Vault.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
