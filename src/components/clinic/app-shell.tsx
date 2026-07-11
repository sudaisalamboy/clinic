'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Package,
  PieChart,
  Receipt,
  Settings as SettingsIcon,
  Stethoscope,
  Truck,
  UserCog,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { DashboardPanel } from './dashboard-panel'
import { AppointmentsPanel } from './appointments-panel'
import { BillingPanel } from './billing-panel'
import { InventoryPanel } from './inventory-panel'
import { SuppliersPanel } from './suppliers-panel'
import { StaffPanel } from './staff-panel'
import { ConsultationFeesPanel } from './consultation-fees-panel'
import { ReportsPanel } from './reports-panel'
import { SettingsPanel } from './settings-panel'

interface User {
  id: string
  name: string
  role: string
}
interface Settings {
  clinicName: string
  currency: string
  doctorName?: string | null
  logo?: string | null
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'consultation', label: 'Consultation', icon: Stethoscope },
  { id: 'reports', label: 'Reports', icon: PieChart },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function AppShell({
  user,
  onLogout,
}: {
  user: User
  onLogout: () => void
}) {
  const [active, setActive] = useState('dashboard')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setSettings)
      .catch(() => {})
  }, [])

  const logout = async () => {
    setLogoutLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast({ title: 'Signed out' })
      onLogout()
    } catch {
      toast({ title: 'Logout failed', variant: 'destructive' })
    } finally {
      setLogoutLoading(false)
    }
  }

  const currency = settings?.currency || '₹'
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              {settings?.logo ? (
                <img src={settings.logo} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <Stethoscope className="h-5 w-5 text-emerald-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">
                {settings?.clinicName || 'My Clinic'}
              </div>
              {settings?.doctorName && (
                <div className="text-xs text-muted-foreground truncate">
                  {settings.doctorName}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                  {initials || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium leading-tight">{user.name}</div>
                <Badge variant="secondary" className="text-[10px] py-0 h-4">
                  {user.role}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              disabled={logoutLoading}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4">
        <Tabs value={active} onValueChange={setActive}>
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <TabsList className="w-auto">
              {tabs.map((t) => {
                const Icon = t.icon
                return (
                  <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:inline">{t.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <TabsContent value="dashboard" className="mt-4">
                <DashboardPanel currency={currency} />
              </TabsContent>
              <TabsContent value="appointments" className="mt-4">
                <AppointmentsPanel currency={currency} />
              </TabsContent>
              <TabsContent value="billing" className="mt-4">
                <BillingPanel currency={currency} />
              </TabsContent>
              <TabsContent value="inventory" className="mt-4">
                <InventoryPanel currency={currency} />
              </TabsContent>
              <TabsContent value="suppliers" className="mt-4">
                <SuppliersPanel />
              </TabsContent>
              <TabsContent value="staff" className="mt-4">
                <StaffPanel currency={currency} />
              </TabsContent>
              <TabsContent value="consultation" className="mt-4">
                <ConsultationFeesPanel currency={currency} />
              </TabsContent>
              <TabsContent value="reports" className="mt-4">
                <ReportsPanel currency={currency} />
              </TabsContent>
              <TabsContent value="settings" className="mt-4">
                <SettingsPanel />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} {settings?.clinicName || 'Clinic Management System'}
        </div>
      </footer>
    </div>
  )
}
