'use client'

import { useState } from 'react'
import { AddPatientDialog } from './add-patient-dialog'
import { BookAppointmentDialog } from './book-appointment-dialog'
import { GenerateBillDialog } from './generate-bill-dialog'

interface PatientOption {
  id: string
  name: string
  phone: string | null
  patientCode: string
  dateOfBirth: string | null
}
interface MedicineOption {
  id: string
  name: string
  price: number
  quantity: number
}
interface DoctorOption {
  id: string
  name: string
  specialization: string | null
  consultationFee: number
  department?: { name: string } | null
}

interface Props {
  patients: PatientOption[]
  medicines: MedicineOption[]
  doctors: DoctorOption[]
  onAnyChange: () => void
}

/**
 * Hosts all three quick action dialogs and refreshes shared data when
 * any of them creates something. Lives at the dashboard root so any
 * button anywhere can open them.
 *
 * `extraPatients` collects newly-created patients so the appointment /
 * bill dialogs see them immediately, before the parent has re-fetched
 * the full patient list. Entries are pruned once they appear in the
 * parent-supplied `patients` array (id match).
 */
export function QuickActionsHost({ patients, medicines, doctors, onAnyChange }: Props) {
  const [extraPatients, setExtraPatients] = useState<PatientOption[]>([])

  // Remove extras that are now present in the canonical patients list.
  const canonicalIds = new Set(patients.map((p) => p.id))
  const visibleExtras = extraPatients.filter((p) => !canonicalIds.has(p.id))

  const allPatients = [...visibleExtras, ...patients]

  return (
    <>
      <AddPatientDialog
        onCreated={(id, name) => {
          setExtraPatients((prev) => [{
            id,
            name,
            phone: null,
            patientCode: '',
            dateOfBirth: null,
          }, ...prev])
          onAnyChange()
        }}
      />
      <BookAppointmentDialog
        patients={allPatients}
        doctors={doctors}
        onBooked={onAnyChange}
      />
      <GenerateBillDialog
        patients={allPatients}
        medicines={medicines}
        onGenerated={onAnyChange}
      />
    </>
  )
}
