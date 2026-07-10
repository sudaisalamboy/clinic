'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PackageX,
  CalendarX,
  X,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from './format'

interface LowStockItem {
  id: string
  name: string
  quantity: number
  reorderLevel: number
  shortfall: number
}
interface ExpiringItem {
  id: string
  name: string
  expiryDate: string
  daysToExpiry: number
  quantity: number
  price: number
}
interface ExpiredItem {
  id: string
  name: string
  expiryDate: string
  daysSinceExpiry: number
  quantity: number
  price: number
}
interface AlertData {
  lowStock: LowStockItem[]
  expiringSoon: ExpiringItem[]
  expired: ExpiredItem[]
  summary: {
    lowStockCount: number
    expiringSoonCount: number
    expiredCount: number
    totalValue: number
  }
}

interface Props {
  refreshKey: number
  onOpenInventory?: () => void
}

export function InventoryAlertBanner({ refreshKey, onOpenInventory }: Props) {
  const [data, setData] = useState<AlertData | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/medicines/alerts')
        if (!res.ok) return
        const d: AlertData = await res.json()
        setData(d)
        setDismissed(false)
      } catch {
        // silent
      }
    })()
  }, [refreshKey])

  if (!data || dismissed) return null
  const total = data.summary.lowStockCount + data.summary.expiringSoonCount + data.summary.expiredCount
  if (total === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/5 border-b">
        <div className="flex items-center gap-2">
          <div className="relative">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
          </div>
          <span className="text-sm font-medium">Inventory alerts</span>
          <Badge variant="secondary" className="font-normal">{total}</Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setDismissed(true)}
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="p-3 grid sm:grid-cols-3 gap-2">
        {/* Expired */}
        {data.summary.expiredCount > 0 && (
          <button
            onClick={onOpenInventory}
            className="text-left flex items-center gap-2 px-3 py-2 rounded-md border bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10 transition"
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 shrink-0">
              <CalendarX className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                {data.summary.expiredCount} expired
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {data.expired[0]?.name}
                {data.summary.expiredCount > 1 ? ` +${data.summary.expiredCount - 1} more` : ''}
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* Expiring soon */}
        {data.summary.expiringSoonCount > 0 && (
          <button
            onClick={onOpenInventory}
            className="text-left flex items-center gap-2 px-3 py-2 rounded-md border bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 transition"
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 shrink-0">
              <CalendarX className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {data.summary.expiringSoonCount} expiring soon
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {data.expiringSoon[0]?.name} · in {data.expiringSoon[0]?.daysToExpiry}d
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* Low stock */}
        {data.summary.lowStockCount > 0 && (
          <button
            onClick={onOpenInventory}
            className="text-left flex items-center gap-2 px-3 py-2 rounded-md border bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 transition"
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 shrink-0">
              <PackageX className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {data.summary.lowStockCount} low stock
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {data.lowStock[0]?.name} · {data.lowStock[0]?.quantity} left
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
