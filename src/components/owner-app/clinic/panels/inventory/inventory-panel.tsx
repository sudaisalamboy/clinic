'use client'

import { useState, useCallback } from 'react'
import { Package, Plus, AlertTriangle, CalendarX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MedicineStockView } from './stock-view'
import { MedicineFormView } from './medicine-form-view'
import { LowStockAlertView } from './low-stock-view'
import { ExpiryAlertView } from './expiry-alert-view'

type View =
  | { kind: 'stock' }
  | { kind: 'add' }
  | { kind: 'edit'; medicineId: string }
  | { kind: 'low-stock' }
  | { kind: 'expiry' }

export function InventoryPanel() {
  const [view, setView] = useState<View>({ kind: 'stock' })
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (view.kind === 'add') {
    return (
      <MedicineFormView
        mode="add"
        onBack={() => setView({ kind: 'stock' })}
        onSaved={(_id) => {
          bump()
          setView({ kind: 'stock' })
        }}
      />
    )
  }

  if (view.kind === 'edit') {
    return (
      <MedicineFormView
        mode="edit"
        medicineId={view.medicineId}
        onBack={() => setView({ kind: 'stock' })}
        onSaved={(_id) => {
          bump()
          setView({ kind: 'stock' })
        }}
      />
    )
  }

  if (view.kind === 'low-stock') {
    return (
      <div className="space-y-4">
        <SubNav active="low-stock" onNavigate={setView} />
        <LowStockAlertView refreshKey={refreshKey} onManage={() => setView({ kind: 'stock' })} />
      </div>
    )
  }

  if (view.kind === 'expiry') {
    return (
      <div className="space-y-4">
        <SubNav active="expiry" onNavigate={setView} />
        <ExpiryAlertView refreshKey={refreshKey} onEdit={(id) => setView({ kind: 'edit', medicineId: id })} />
      </div>
    )
  }

  // Default: stock list
  return (
    <div className="space-y-4">
      <SubNav active="stock" onNavigate={setView} />
      <MedicineStockView
        refreshKey={refreshKey}
        onAdd={() => setView({ kind: 'add' })}
        onEdit={(id) => setView({ kind: 'edit', medicineId: id })}
      />
    </div>
  )
}

function SubNav({
  active,
  onNavigate,
}: {
  active: 'stock' | 'low-stock' | 'expiry'
  onNavigate: (v: View) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="inline-flex rounded-md border overflow-hidden">
        <Button
          size="sm"
          variant={active === 'stock' ? 'default' : 'ghost'}
          onClick={() => onNavigate({ kind: 'stock' })}
          className="rounded-none gap-1.5"
        >
          <Package className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Stock</span>
        </Button>
        <Button
          size="sm"
          variant={active === 'low-stock' ? 'default' : 'ghost'}
          onClick={() => onNavigate({ kind: 'low-stock' })}
          className="rounded-none gap-1.5"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Low Stock</span>
        </Button>
        <Button
          size="sm"
          variant={active === 'expiry' ? 'default' : 'ghost'}
          onClick={() => onNavigate({ kind: 'expiry' })}
          className="rounded-none gap-1.5"
        >
          <CalendarX className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Expiry</span>
        </Button>
      </div>
      <Button size="sm" onClick={() => onNavigate({ kind: 'add' })}>
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Add medicine</span>
        <span className="sm:hidden">New</span>
      </Button>
    </div>
  )
}
