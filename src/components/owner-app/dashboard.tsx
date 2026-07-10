'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Lock,
  LogOut,
  Shield,
  Clock,
  LayoutGrid,
  Users,
  Stethoscope,
  CalendarCheck,
  ReceiptText,
  Package,
  FileText,
  FlaskConical,
  Settings as SettingsIcon,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useIdleTimer } from './use-idle-timer'
import { OverviewPanel } from './panels/overview'
import { NotesPanel } from './panels/notes'
import { LinksPanel } from './panels/links'
import { SettingsPanel } from './panels/settings'
import { ActivityPanel } from './panels/activity'
import {
  QuickActionsProvider,
} from './clinic/quick-actions-context'
import { QuickActionsHost } from './clinic/quick-actions-host'
import { ClinicDashboardPanel } from './clinic/panels/clinic-dashboard'
import { PatientsPanel } from './clinic/panels/patients-panel'
import { DoctorsPanel } from './clinic/panels/doctors-panel'
import { AppointmentsPanel } from './clinic/panels/appointments/appointments-panel'
import { BillsPanel } from './clinic/panels/bills/bills-panel'
import { InventoryPanel } from './clinic/panels/inventory/inventory-panel'
import { PrescriptionsPanel } from './clinic/panels/prescriptions/prescriptions-panel'
import { LabTestsPanel } from './clinic/panels/lab-tests/lab-tests-panel'
import { ReminderBanner } from './clinic/reminder-banner'
import { InventoryAlertBanner } from './clinic/inventory-alert-banner'

interface OwnerInfo {
  id: string
  name: string
  autoLockMinutes: number
  passwordHint?: string | null
  createdAt?: string | Date
}

interface Props {
  owner: OwnerInfo
  onLock: () => void
}

function fmtRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s >= 60) {
    const m = Math.floor(s / 60)
    const rs = s % 60
    return `${m}:${rs.toString().padStart(2, '0')}`
  }
  return `0:${s.toString().padStart(2, '0')}`
}

export function Dashboard({ owner, onLock }: Props) {
  const [autoLockMs, setAutoLockMs] = useState(owner.autoLockMinutes * 60 * 1000)
  const [tab, setTab] = useState('clinic')
  // refreshKey bumps trigger a re-fetch in dashboard/patients/etc. after a quick action.
  const [refreshKey, setRefreshKey] = useState(0)
  // Lightweight lists of patients + medicines for the quick action dialogs.
  const [patientsForDialogs, setPatientsForDialogs] = useState<
    {
      id: string
      name: string
      phone: string | null
      patientCode: string
      dateOfBirth: string | null
    }[]
  >([])
  const [medicinesForDialogs, setMedicinesForDialogs] = useState<
    { id: string; name: string; genericName: string | null; price: number; quantity: number }[]
  >([])
  const [doctorsForDialogs, setDoctorsForDialogs] = useState<
    {
      id: string
      name: string
      specialization: string | null
      consultationFee: number
      department?: { name: string } | null
    }[]
  >([])

  // Periodically extend the session while the user is active (every 60s).
  const extend = useCallback(async () => {
    try {
      const res = await fetch('/api/extend', { method: 'POST' })
      if (!res.ok) throw new Error('extend failed')
      const data = await res.json()
      if (data.autoLockMinutes) {
        setAutoLockMs(data.autoLockMinutes * 60 * 1000)
      }
    } catch {
      // ignore — auto-lock will handle it
    }
  }, [])

  // Idle timer triggers auto-lock
  const { remainingMs } = useIdleTimer(autoLockMs, onLock)

  // Heartbeat: every 60s, refresh the session cookie as long as the tab is focused
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void extend()
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [extend])

  // Show "warning" state when less than 60s left
  const warning = remainingMs <= 60_000
  const danger = remainingMs <= 15_000

  // Load lightweight patient + medicine + doctor lists for the quick action dialogs.
  const refreshDialogData = useCallback(async () => {
    try {
      const [pRes, mRes, dRes] = await Promise.all([
        fetch('/api/patients'),
        fetch('/api/medicines'),
        fetch('/api/doctors?limit=100'),
      ])
      if (pRes.ok) {
        const d = await pRes.json()
        setPatientsForDialogs(
          (d.patients ?? []).slice(0, 100).map((p: {
            id: string
            name: string
            phone: string | null
            patientCode: string
            dateOfBirth: string | null
          }) => ({
            id: p.id,
            name: p.name,
            phone: p.phone ?? null,
            patientCode: p.patientCode,
            dateOfBirth: p.dateOfBirth ?? null,
          })),
        )
      }
      if (mRes.ok) {
        const d = await mRes.json()
        setMedicinesForDialogs(
          (d.medicines ?? []).slice(0, 100).map((m: {
            id: string
            name: string
            genericName: string | null
            price: number
            quantity: number
          }) => ({
            id: m.id,
            name: m.name,
            genericName: m.genericName ?? null,
            price: m.price,
            quantity: m.quantity,
          })),
        )
      }
      if (dRes.ok) {
        const d = await dRes.json()
        setDoctorsForDialogs(
          (d.doctors ?? []).slice(0, 100).map((doc: {
            id: string
            name: string
            specialization: string | null
            consultationFee: number
            department?: { name: string } | null
          }) => ({
            id: doc.id,
            name: doc.name,
            specialization: doc.specialization,
            consultationFee: doc.consultationFee,
            department: doc.department ?? null,
          })),
        )
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void refreshDialogData()
  }, [refreshDialogData, refreshKey])

  async function handleManualLock() {
    try {
      await fetch('/api/lock', { method: 'POST' })
    } catch {
      // ignore
    }
    onLock()
  }

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    onLock()
  }

  return (
    <QuickActionsProvider>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 shrink-0">
                <Shield className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">Clinic Vault</p>
                <p className="text-xs text-muted-foreground truncate">{owner.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`hidden sm:inline-flex tabular-nums font-mono gap-1.5 ${
                  danger
                    ? 'border-destructive/50 text-destructive bg-destructive/5'
                    : warning
                      ? 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                      : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                }`}
                title="Time until auto-lock"
              >
                <Clock className="h-3 w-3" />
                {fmtRemaining(remainingMs)}
              </Badge>
              <Button size="sm" variant="outline" onClick={handleManualLock} className="gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lock</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
          <ReminderBanner refreshKey={refreshKey} onOpenAppointment={() => setTab('appointments')} />
          <InventoryAlertBanner refreshKey={refreshKey} onOpenInventory={() => setTab('inventory')} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-12 mb-6 h-auto">
              <TabsTrigger value="clinic" className="gap-1.5 py-2">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Home</span>
              </TabsTrigger>
              <TabsTrigger value="patients" className="gap-1.5 py-2">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Patients</span>
              </TabsTrigger>
              <TabsTrigger value="doctors" className="gap-1.5 py-2">
                <Stethoscope className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Doctors</span>
              </TabsTrigger>
              <TabsTrigger value="appointments" className="gap-1.5 py-2">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Appts</span>
                <span className="hidden sm:inline lg:hidden">Appts</span>
              </TabsTrigger>
              <TabsTrigger value="bills" className="gap-1.5 py-2">
                <ReceiptText className="h-3.5 w-3.5" />
                Bills
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-1.5 py-2">
                <Package className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Inventory</span>
                <span className="sm:hidden">Stock</span>
              </TabsTrigger>
              <TabsTrigger value="prescriptions" className="gap-1.5 py-2">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rx</span>
                <span className="sm:hidden">Rx</span>
              </TabsTrigger>
              <TabsTrigger value="labs" className="gap-1.5 py-2">
                <FlaskConical className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Labs</span>
                <span className="sm:hidden">Lab</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5 py-2">
                <span className="hidden sm:inline">Notes</span>
                <span className="sm:hidden">Notes</span>
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1.5 py-2">
                <span className="hidden sm:inline">Links</span>
                <span className="sm:hidden">Links</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 py-2">
                <Activity className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Activity</span>
                <span className="sm:hidden">Logs</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 py-2">
                <SettingsIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="clinic" className="mt-0">
                <ClinicDashboardPanel onGoTo={setTab} refreshKey={refreshKey} />
              </TabsContent>
              <TabsContent value="patients" className="mt-0">
                <PatientsPanel />
              </TabsContent>
              <TabsContent value="doctors" className="mt-0">
                <DoctorsPanel />
              </TabsContent>
              <TabsContent value="appointments" className="mt-0">
                <AppointmentsPanel
                  patients={patientsForDialogs}
                  doctors={doctorsForDialogs}
                  refreshKey={refreshKey}
                  onChanged={() => setRefreshKey((k) => k + 1)}
                />
              </TabsContent>
              <TabsContent value="bills" className="mt-0">
                <BillsPanel
                  patients={patientsForDialogs}
                  doctors={doctorsForDialogs}
                  medicines={medicinesForDialogs}
                />
              </TabsContent>
              <TabsContent value="inventory" className="mt-0">
                <InventoryPanel />
              </TabsContent>
              <TabsContent value="prescriptions" className="mt-0">
                <PrescriptionsPanel
                  patients={patientsForDialogs}
                  doctors={doctorsForDialogs}
                  medicines={medicinesForDialogs}
                />
              </TabsContent>
              <TabsContent value="labs" className="mt-0">
                <LabTestsPanel
                  patients={patientsForDialogs}
                  doctors={doctorsForDialogs}
                />
              </TabsContent>
              <TabsContent value="notes" className="mt-0">
                <NotesPanel />
              </TabsContent>
              <TabsContent value="links" className="mt-0">
                <LinksPanel />
              </TabsContent>
              <TabsContent value="activity" className="mt-0">
                <ActivityPanel />
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <SettingsPanel owner={owner} onAutoLockChange={(m) => setAutoLockMs(m * 60 * 1000)} onLock={onLock} />
              </TabsContent>
            </motion.div>
          </Tabs>
        </main>

        <footer className="mt-auto border-t bg-background/60 py-4 text-center text-xs text-muted-foreground">
          <p>Single-owner clinic vault. Auto-locks after {owner.autoLockMinutes}m of inactivity.</p>
        </footer>

        {/* Quick-action modals — mounted once, controlled by context */}
        <QuickActionsHost
          patients={patientsForDialogs}
          medicines={medicinesForDialogs}
          doctors={doctorsForDialogs}
          onAnyChange={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </QuickActionsProvider>
  )
}
