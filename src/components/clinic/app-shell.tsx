'use client'

import { useEffect, useState, useCallback } from 'react'
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
  Users,
  ChevronLeft,
  ChevronsLeft,
  Menu,
  Search,
  Bell,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Main' },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, group: 'Operations' },
  { id: 'billing', label: 'Billing', icon: Receipt, group: 'Operations' },
  { id: 'inventory', label: 'Inventory', icon: Package, group: 'Operations' },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, group: 'Operations' },
  { id: 'staff', label: 'Staff', icon: Users, group: 'Operations' },
  { id: 'consultation', label: 'Consultation', icon: Stethoscope, group: 'Operations' },
  { id: 'reports', label: 'Reports', icon: PieChart, group: 'Insights' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, group: 'System' },
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
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
      onLogout()
    } catch {
      toast({ title: 'Logout failed', variant: 'destructive' })
    } finally {
      setLogoutLoading(false)
    }
  }

  const currency = settings?.currency || '₹'
  const initials = user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  // Group nav items
  const groups = nav.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {} as Record<string, typeof nav>)

  const activeLabel = nav.find((n) => n.id === active)?.label || 'Dashboard'

  return (
    <div className="h-screen flex overflow-hidden bg-muted/20">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-60' : 'w-16'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 ease-out`}
      >
        {/* Logo / Clinic name */}
        <div className="h-14 flex items-center gap-2.5 px-3 border-b border-sidebar-border shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            {settings?.logo ? (
              <img src={settings.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <Stethoscope className="h-4.5 w-4.5 text-primary" />
            )}
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate text-sidebar-foreground">
                {settings?.clinicName || 'Clinic'}
              </div>
              <div className="text-[10px] text-sidebar-foreground/50 truncate">
                {settings?.doctorName || 'Admin Panel'}
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <span className="hidden lg:block text-[10px] text-sidebar-foreground/40 writing-vertical">
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              {sidebarOpen && (
                <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {group}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = active === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActive(item.id)
                        setMobileOpen(false)
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all relative group ${
                        isActive
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5'
                      }`}
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary" />
                      )}
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:block border-t border-sidebar-border p-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-sidebar-foreground/50 hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground transition"
          >
            <ChevronsLeft className={`h-3.5 w-3.5 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b bg-background/80 backdrop-blur flex items-center justify-between gap-3 px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 -ml-1 rounded-md hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold">{activeLabel}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Search (hidden on mobile) */}
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="h-8 w-48 pl-8 text-sm"
              />
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted transition">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-medium leading-tight">{user.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{user.role}</div>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActive('settings')}>
                  <SettingsIcon className="h-3.5 w-3.5 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  disabled={logoutLoading}
                  className="text-rose-600 focus:text-rose-600"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {active === 'dashboard' && <DashboardPanel currency={currency} />}
              {active === 'appointments' && <AppointmentsPanel currency={currency} />}
              {active === 'billing' && <BillingPanel currency={currency} />}
              {active === 'inventory' && <InventoryPanel currency={currency} />}
              {active === 'suppliers' && <SuppliersPanel />}
              {active === 'staff' && <StaffPanel currency={currency} />}
              {active === 'consultation' && <ConsultationFeesPanel currency={currency} />}
              {active === 'reports' && <ReportsPanel currency={currency} />}
              {active === 'settings' && <SettingsPanel />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
