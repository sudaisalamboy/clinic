'use client'

import { useState, useCallback, useEffect } from 'react'
import { FlaskConical, ClipboardList, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LabTestsListView } from './lab-tests-list-view'
import { LabTestFormView } from './lab-test-form-view'
import { PatientTestReportsView } from './patient-test-reports-view'
import { TestResultView } from './test-result-view'

type View =
  | { kind: 'catalog' }
  | { kind: 'add-test' }
  | { kind: 'edit-test'; testId: string }
  | { kind: 'reports' }
  | { kind: 'result'; patientTestId: string }

interface PatientOption {
  id: string
  name: string
  patientCode: string
  phone: string | null
  dateOfBirth: string | null
}
interface DoctorOption {
  id: string
  name: string
  specialization: string | null
}
interface LabTestOption {
  id: string
  name: string
  category: string | null
  price: number
  status: string
}

interface Props {
  patients: PatientOption[]
  doctors: DoctorOption[]
}

export function LabTestsPanel({ patients, doctors }: Props) {
  const [view, setView] = useState<View>({ kind: 'catalog' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [labTests, setLabTests] = useState<LabTestOption[]>([])
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Fetch lab tests catalog for the assign dialog
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/lab-tests')
        if (!res.ok) return
        const data = await res.json()
        setLabTests((data.labTests ?? []).map((t: LabTestOption) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          price: t.price,
          status: t.status,
        })))
      } catch { /* ignore */ }
    })()
  }, [refreshKey])

  if (view.kind === 'add-test') {
    return (
      <LabTestFormView
        mode="add"
        onBack={() => setView({ kind: 'catalog' })}
        onSaved={(_id) => {
          bump()
          setView({ kind: 'catalog' })
        }}
      />
    )
  }

  if (view.kind === 'edit-test') {
    return (
      <LabTestFormView
        mode="edit"
        testId={view.testId}
        onBack={() => setView({ kind: 'catalog' })}
        onSaved={(_id) => {
          bump()
          setView({ kind: 'catalog' })
        }}
      />
    )
  }

  if (view.kind === 'result') {
    return (
      <TestResultView
        patientTestId={view.patientTestId}
        onBack={() => {
          bump()
          setView({ kind: 'reports' })
        }}
        onChanged={bump}
      />
    )
  }

  // Catalog and Reports views share a sub-nav
  const activeSub = view.kind === 'reports' ? 'reports' : 'catalog'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border overflow-hidden">
          <Button
            size="sm"
            variant={activeSub === 'catalog' ? 'default' : 'ghost'}
            onClick={() => setView({ kind: 'catalog' })}
            className="rounded-none gap-1.5"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Test Catalog</span>
            <span className="sm:hidden">Tests</span>
          </Button>
          <Button
            size="sm"
            variant={activeSub === 'reports' ? 'default' : 'ghost'}
            onClick={() => setView({ kind: 'reports' })}
            className="rounded-none gap-1.5"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Patient Reports</span>
            <span className="sm:hidden">Reports</span>
          </Button>
        </div>
        {activeSub === 'catalog' ? (
          <Button size="sm" onClick={() => setView({ kind: 'add-test' })}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add test</span>
            <span className="sm:hidden">New</span>
          </Button>
        ) : (
          <Button size="sm" onClick={() => setView({ kind: 'reports' })}>
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Patient Reports</span>
          </Button>
        )}
      </div>

      {activeSub === 'catalog' ? (
        <LabTestsListView
          refreshKey={refreshKey}
          onAdd={() => setView({ kind: 'add-test' })}
          onEdit={(id) => setView({ kind: 'edit-test', testId: id })}
        />
      ) : (
        <PatientTestReportsView
          patients={patients}
          doctors={doctors}
          labTests={labTests}
          refreshKey={refreshKey}
          onOpenResult={(id) => setView({ kind: 'result', patientTestId: id })}
          onChanged={bump}
        />
      )}
    </div>
  )
}
