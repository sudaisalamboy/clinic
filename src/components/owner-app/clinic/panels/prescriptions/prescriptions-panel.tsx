'use client'

import { useState, useCallback } from 'react'
import { CreatePrescriptionView } from './create-view'
import { AllPrescriptionsView } from './list-view'
import { PrescriptionDetailsView } from './details-view'

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'details'; prescriptionId: string }

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
}

export function PrescriptionsPanel({ patients, doctors, medicines }: Props) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (view.kind === 'create') {
    return (
      <CreatePrescriptionView
        patients={patients}
        doctors={doctors}
        medicines={medicines}
        onBack={() => setView({ kind: 'list' })}
        onCreated={(id) => {
          bump()
          setView({ kind: 'details', prescriptionId: id })
        }}
      />
    )
  }

  if (view.kind === 'details') {
    return (
      <PrescriptionDetailsView
        prescriptionId={view.prescriptionId}
        onBack={() => {
          bump()
          setView({ kind: 'list' })
        }}
      />
    )
  }

  return (
    <AllPrescriptionsView
      refreshKey={refreshKey}
      onCreate={() => setView({ kind: 'create' })}
      onOpenPrescription={(id) => setView({ kind: 'details', prescriptionId: id })}
    />
  )
}
