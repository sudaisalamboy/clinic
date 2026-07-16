'use client'

import { useState, useCallback } from 'react'
import { PatientListView } from './patient-list-view'
import { PatientFormView } from './patient-form-view'
import { PatientProfileView } from './patient-profile-view'

type View =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; patientId: string }
  | { kind: 'profile'; patientId: string }

export function PatientsPanel() {
  const [view, setView] = useState<View>({ kind: 'list' })
  // bump to trigger list refresh when returning from add/edit/delete
  const [refreshKey, setRefreshKey] = useState(0)

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (view.kind === 'add') {
    return (
      <PatientFormView
        mode="add"
        onBack={() => setView({ kind: 'list' })}
        onSaved={(id) => {
          bump()
          setView({ kind: 'profile', patientId: id })
        }}
      />
    )
  }

  if (view.kind === 'edit') {
    return (
      <PatientFormView
        mode="edit"
        patientId={view.patientId}
        onBack={() => setView({ kind: 'profile', patientId: view.patientId })}
        onSaved={(_id) => {
          bump()
          setView({ kind: 'profile', patientId: view.patientId })
        }}
      />
    )
  }

  if (view.kind === 'profile') {
    return (
      <PatientProfileView
        patientId={view.patientId}
        onBack={() => {
          bump()
          setView({ kind: 'list' })
        }}
        onEdit={() => setView({ kind: 'edit', patientId: view.patientId })}
        onChanged={bump}
      />
    )
  }

  return (
    <PatientListView
      refreshKey={refreshKey}
      onAddPatient={() => setView({ kind: 'add' })}
      onOpenPatient={(id) => setView({ kind: 'profile', patientId: id })}
      onEditPatient={(id) => setView({ kind: 'edit', patientId: id })}
    />
  )
}
