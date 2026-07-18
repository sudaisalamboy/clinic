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
  ChevronsLeft,
  Menu,
  Search,
  Bell,
  ChevronDown,
  AlertTriangle,
  X,
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
  primaryColor?: string
  accentColor?: string
}

interface StockAlert {
  id: string
  name: string
  quantity: number
  minStock: number
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
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const { toast } = useToast()

  const fetchSettings = useCallback(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setSettings)
      .catch(() => {})
  }, [])

  const fetchStockAlerts = useCallback(() => {
    fetch('/api/inventory/items?filter=low')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        // Items where stock is at or below 90% of minStock threshold
        const alerts = (d.items || d || []).filter((item: StockAlert) =>
          item.minStock > 0 && item.quantity <= Math.ceil(item.minStock * 0.9)
        )
        setStockAlerts(alerts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchStockAlerts()
    const id = setInterval(fetchStockAlerts, 60000) // check every minute
    return () => clearInterval(id)
  }, [fetchSettings, fetchStockAlerts])

  // Apply theme colors as CSS variables
  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--app-primary', settings.primaryColor)
    }
    if (settings?.accentColor) {
      document.documentElement.style.setProperty('--app-accent', settings.accentColor)
    }
  }, [settings?.primaryColor, settings?.accentColor])

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
  const primaryColor = settings?.primaryColor || '#10b981'
  const accentColor = settings?.accentColor || '#0d9488'

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
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: primaryColor + '20' }}
          >
            {settings?.logo ? (
              <img src={settings.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <Stethoscope className="h-4.5 w-4.5" style={{ color: primaryColor }} />
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
                          ? 'font-medium'
                          : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5'
                      }`}
                      style={isActive ? {
                        backgroundColor: primaryColor + '20',
                        color: primaryColor,
                      } : {}}
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                      <Icon className={`h-4 w-4 shrink-0`} style={isActive ? { color: primaryColor } : {}} />
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
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
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="h-8 w-48 pl-8 text-sm"
              />
            </div>

            {/* Notifications dropdown with low-stock alerts */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                  <Bell className="h-4 w-4" />
                  {stockAlerts.length > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse-glow"
                      style={{ backgroundColor: '#ef4444' }}
                    >
                      {stockAlerts.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  {stockAlerts.length > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{stockAlerts.length} alerts</Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {stockAlerts.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Bell className="h-6 w-6 mx-auto mb-1 opacity-30" />
                    All good — no alerts
                  </div>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto">
                      {stockAlerts.map((item) => {
                        const pct = item.minStock > 0 ? Math.round((item.quantity / item.minStock) * 100) : 0
                        return (
                          <DropdownMenuItem
                            key={item.id}
                            className="flex-col items-start py-2 cursor-pointer"
                            onClick={() => setActive('inventory')}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                              <Badge variant="destructive" className="text-[10px]">{item.quantity} left</Badge>
                            </div>
                            <div className="flex items-center gap-2 w-full mt-1">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(pct, 100)}%`,
                                    backgroundColor: pct < 50 ? '#ef4444' : '#f59e0b',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                min: {item.minStock}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-center justify-center text-xs text-muted-foreground cursor-pointer"
                      onClick={() => setActive('inventory')}
                    >
                      View all inventory →
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted transition">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback
                      className="text-[10px] font-semibold"
                      style={{ backgroundColor: primaryColor + '20', color: primaryColor }}
                    >
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
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {active === 'dashboard' && <DashboardPanel currency={currency} />}
              {active === 'appointments' && <AppointmentsPanel currency={currency} />}
              {active === 'billing' && <BillingPanel currency={currency} />}
              {active === 'inventory' && <InventoryPanel currency={currency} />}
              {active === 'suppliers' && <SuppliersPanel />}
              {active === 'staff' && <StaffPanel currency={currency} />}
              {active === 'consultation' && <ConsultationFeesPanel currency={currency} />}
              {active === 'reports' && <ReportsPanel currency={currency} />}
              {active === 'settings' && <SettingsPanel onSettingsSaved={fetchSettings} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer credit */}
        <footer className="h-8 border-t flex items-center justify-between px-4 shrink-0 text-[10px] text-muted-foreground">
          <span>© {new Date().getFullYear()} {settings?.clinicName || 'Clinic'}</span>
          <span>
            Made with ❤️ by{' '}
            <a
              href="https://github.com/sudaisalamboy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-emerald-600 transition-colors"
            >
              Sudais Alam
            </a>
          </span>
        </footer>
      </div>
    </div>
  )
}
