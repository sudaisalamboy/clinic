/** Prescription helpers shared across views. */

export interface PrescribedMedicine {
  medicineId?: string | null
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string | null
}

export interface PrescriptionListItem {
  id: string
  prescriptionNumber: string
  medicines: PrescribedMedicine[]
  advice: string | null
  nextVisitDate: string | null
  createdAt: string
  patient: { id: string; name: string; patientCode: string; phone: string | null; dateOfBirth: string | null; gender: string | null }
  doctor: { id: string; name: string; specialization: string | null; department?: { name: string } | null } | null
  medicalRecord: { id: string; diagnosis: string | null; symptoms: string | null; visitDate: string }
}

export interface PrescriptionDetail extends PrescriptionListItem {
  advice: string | null
  nextVisitDate: string | null
  patient: {
    id: string
    name: string
    patientCode: string
    phone: string | null
    email: string | null
    dateOfBirth: string | null
    gender: string | null
    bloodGroup: string | null
    address: string | null
  }
  medicalRecord: {
    id: string
    visitDate: string
    symptoms: string | null
    temperature: string | null
    bloodPressure: string | null
    pulse: string | null
    weight: string | null
    height: string | null
    diagnosis: string | null
    notes: string | null
  }
}
