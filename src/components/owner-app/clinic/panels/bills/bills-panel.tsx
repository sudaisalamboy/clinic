'use client'

import { useState, useCallback } from 'react'
import { ReceiptText, Plus, List, History, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GenerateBillView } from './generate-view'
import { AllBillsView } from './list-view'
import { BillDetailsView } from './details-view'
import { PaymentHistoryView } from './payment-history-view'
import { RevenueReportView } from './revenue-view'

type View =
  | { kind: 'list' }
  | { kind: 'generate' }
  | { kind: 'details'; billId: string }
  | { kind: 'payments' }
  | { kind: 'revenue' }

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
interface MedicineOption {
  id: string
  name: string
  price: number
  quantity: number
}

interface Props {
  patients: PatientOption[]
  doctors: DoctorOption[]
  medicines: MedicineOption[]
}

export function BillsPanel({ patients, doctors, medicines }: Props) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (view.kind === 'generate') {
    return (
      <GenerateBillView
        patients={patients}
        doctors={doctors}
        medicines={medicines}
        onBack={() => setView({ kind: 'list' })}
        onGenerated={(_id) => {
          bump()
          setView({ kind: 'list' })
        }}
      />
    )
  }

  if (view.kind === 'details') {
    return (
      <BillDetailsView
        billId={view.billId}
        onBack={() => {
          bump()
          setView({ kind: 'list' })
        }}
        onChanged={bump}
      />
    )
  }

  if (view.kind === 'payments') {
    return (
      <div className="space-y-4">
        <SubNav active="payments" onNavigate={setView} />
        <PaymentHistoryView onOpenBill={(id) => setView({ kind: 'details', billId: id })} />
      </div>
    )
  }

  if (view.kind === 'revenue') {
    return (
      <div className="space-y-4">
        <SubNav active="revenue" onNavigate={setView} />
        <RevenueReportView />
      </div>
    )
  }

  // Default: list view
  return (
    <div className="space-y-4">
      <SubNav active="list" onNavigate={setView} />
      <AllBillsView
        refreshKey={refreshKey}
        onGenerate={() => setView({ kind: 'generate' })}
        onOpenBill={(id) => setView({ kind: 'details', billId: id })}
      />
    </div>
  )
}

function SubNav({
  active,
  onNavigate,
}: {
  active: 'list' | 'payments' | 'revenue'
  onNavigate: (v: View) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="inline-flex rounded-md border overflow-hidden">
        <Button
          size="sm"
          variant={active === 'list' ? 'default' : 'ghost'}
          onClick={() => onNavigate({ kind: 'list' })}
          className="rounded-none gap-1.5"
        >
          <List className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">All Bills</span>
        </Button>
        <Button
          size="sm"
          variant={active === 'payments' ? 'default' : 'ghost'}
          onClick={() => onNavigate({ kind: 'payments' })}
          className="rounded-none gap-1.5"
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Payments</span>
        </Button>
        <Button
          size="sm"
          variant={active === 'revenue' ? 'default' : 'ghost'}
          onClick={() => onNavigate({ kind: 'revenue' })}
          className="rounded-none gap-1.5"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Revenue</span>
        </Button>
      </div>
      <Button size="sm" onClick={() => onNavigate({ kind: 'generate' })}>
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Generate bill</span>
        <span className="sm:hidden">New</span>
      </Button>
    </div>
  )
}
