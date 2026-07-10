'use client'

import { useState, useCallback } from 'react'
import { Calendar as CalendarIcon, CalendarPlus, CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CalendarView } from './calendar-view'
import { BookAppointmentView } from './book-view'
import { TodayAppointmentsView } from './today-view'
import { AppointmentDetailDialog } from './detail-dialog'

type View = 'calendar' | 'book' | 'today'

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

interface Props {
  patients: PatientOption[]
  doctors: DoctorOption[]
  initialView?: View
  refreshKey: number
  onChanged: () => void
}

export function AppointmentsPanel({ patients, doctors, initialView = 'today', onChanged }: Props) {
  const [view, setView] = useState<View>(initialView)
  const [detailId, setDetailId] = useState<string | null>(null)

  const openDetail = useCallback((id: string) => setDetailId(id), [])
  const closeDetail = useCallback(() => setDetailId(null), [])

  if (view === 'book') {
    return (
      <BookAppointmentView
        patients={patients}
        doctors={doctors}
        onBack={() => setView('today')}
        onBooked={(_id) => {
          onChanged()
          setView('today')
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* View switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border overflow-hidden">
          <Button
            size="sm"
            variant={view === 'today' ? 'default' : 'ghost'}
            onClick={() => setView('today')}
            className="rounded-none gap-1.5"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Today</span>
          </Button>
          <Button
            size="sm"
            variant={view === 'calendar' ? 'default' : 'ghost'}
            onClick={() => setView('calendar')}
            className="rounded-none gap-1.5"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Calendar</span>
          </Button>
        </div>
        <Button size="sm" onClick={() => setView('book')}>
          <CalendarPlus className="h-3.5 w-3.5" />
          Book appointment
        </Button>
      </div>

      {view === 'calendar' ? (
        <CalendarView
          onBook={() => setView('book')}
          onOpenAppointment={openDetail}
        />
      ) : (
        <TodayAppointmentsView
          onOpenAppointment={openDetail}
          onBook={() => setView('book')}
        />
      )}

      <AppointmentDetailDialog
        appointmentId={detailId}
        onClose={closeDetail}
      />
    </div>
  )
}
