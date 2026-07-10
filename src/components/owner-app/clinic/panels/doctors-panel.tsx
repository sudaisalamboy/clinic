'use client'

import { useState, useCallback } from 'react'
import { DoctorListView } from './doctor/doctor-list-view'
import { DoctorFormView } from './doctor/doctor-form-view'
import { DoctorProfileView } from './doctor/doctor-profile-view'

type View =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; doctorId: string }
  | { kind: 'profile'; doctorId: string }

export function DoctorsPanel() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (view.kind === 'add') {
    return (
      <DoctorFormView
        mode="add"
        onBack={() => setView({ kind: 'list' })}
        onSaved={(id) => {
          bump()
          setView({ kind: 'profile', doctorId: id })
        }}
      />
    )
  }

  if (view.kind === 'edit') {
    return (
      <DoctorFormView
        mode="edit"
        doctorId={view.doctorId}
        onBack={() => setView({ kind: 'profile', doctorId: view.doctorId })}
        onSaved={(_id) => {
          bump()
          setView({ kind: 'profile', doctorId: view.doctorId })
        }}
      />
    )
  }

  if (view.kind === 'profile') {
    return (
      <DoctorProfileView
        doctorId={view.doctorId}
        onBack={() => {
          bump()
          setView({ kind: 'list' })
        }}
        onEdit={() => setView({ kind: 'edit', doctorId: view.doctorId })}
        onChanged={bump}
      />
    )
  }

  return (
    <DoctorListView
      refreshKey={refreshKey}
      onAddDoctor={() => setView({ kind: 'add' })}
      onOpenDoctor={(id) => setView({ kind: 'profile', doctorId: id })}
      onEditDoctor={(id) => setView({ kind: 'edit', doctorId: id })}
    />
  )
}
