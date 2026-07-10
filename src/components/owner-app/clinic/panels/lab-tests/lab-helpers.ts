/** Lab test helpers shared across views. */

export type LabTestStatus = 'Pending' | 'In Progress' | 'Completed'

export const STATUS_FLOW: LabTestStatus[] = ['Pending', 'In Progress', 'Completed']

export const STATUS_META: Record<LabTestStatus, { label: string; cls: string; dotCls: string }> = {
  Pending: {
    label: 'Pending',
    cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5',
    dotCls: 'bg-amber-500',
  },
  'In Progress': {
    label: 'In Progress',
    cls: 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/5',
    dotCls: 'bg-sky-500',
  },
  Completed: {
    label: 'Completed',
    cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
    dotCls: 'bg-emerald-500',
  },
}

export function nextStatus(s: LabTestStatus): LabTestStatus | null {
  const idx = STATUS_FLOW.indexOf(s)
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

export interface ResultValue {
  parameter: string
  value: string
  unit: string | null
  flag: 'Normal' | 'High' | 'Low' | 'Abnormal' | '' | null
}

export const FLAG_META: Record<string, { cls: string }> = {
  Normal: { cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' },
  High: { cls: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5' },
  Low: { cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5' },
  Abnormal: { cls: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5' },
  '': { cls: '' },
}

export interface LabTest {
  id: string
  name: string
  category: string | null
  description: string | null
  price: number
  referenceRange: string | null
  sampleType: string | null
  turnaroundHours: number | null
  status: string
  createdAt: string
  _count?: { patientTests: number }
}

export interface PatientLabTest {
  id: string
  testNumber: string
  patientId: string
  labTestId: string
  doctorId: string | null
  appointmentId: string | null
  status: LabTestStatus
  resultValues: ResultValue[]
  resultNotes: string | null
  resultFile: string | null
  resultFileName: string | null
  resultFileType: string | null
  resultFileUrl?: string | null
  requestedAt: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
  patient: { id: string; name: string; patientCode: string; phone: string | null; dateOfBirth: string | null; gender: string | null }
  labTest: { id: string; name: string; category: string | null; price: number; referenceRange: string | null; sampleType: string | null }
  doctor: { id: string; name: string; specialization: string | null } | null
}
