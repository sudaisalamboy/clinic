'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  AlertTriangle,
  PackagePlus,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '../../format'
import { type Medicine, stockStatus } from './inventory-helpers'

interface Props {
  refreshKey: number
  onManage: () => void
}

interface LowStockItem extends Medicine {
  shortfall: number
}

export function LowStockAlertView({ refreshKey, onManage }: Props) {
  const { toast } = useToast()
  const [items, setItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [restockTarget, setRestockTarget] = useState<LowStockItem | null>(null)
  const [restockQty, setRestockQty] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Use the alerts endpoint to get low-stock items with shortfall
      const res = await fetch('/api/medicines/alerts')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setItems(data.lowStock)
    } catch {
      toast({ title: 'Failed to load low-stock alerts', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load, refreshKey])

  async function doRestock() {
    if (!restockTarget) return
    const qty = parseInt(restockQty, 10)
    if (!qty || qty <= 0) return
    try {
      const res = await fetch(`/api/medicines/${restockTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restockBy: qty }),
      })
      if (!res.ok) throw new Error('restock failed')
      toast({ title: `Restocked +${qty}`, description: restockTarget.name })
      setRestockTarget(null)
      setRestockQty('')
      void load()
    } catch {
      toast({ title: 'Failed to restock', variant: 'destructive' })
    }
  }

  const totalShortfall = items.reduce((s, m) => s + m.shortfall, 0)
  const criticalCount = items.filter((m) => m.quantity <= 0).length
  const outOfStockCount = items.filter((m) => m.quantity === 0).length

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Low stock alerts
          <Badge variant="secondary" className="font-normal">{items.length}</Badge>
        </CardTitle>
        <CardDescription className="text-sm">
          Medicines below their reorder level. Restock to avoid running out.
        </CardDescription>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-xs font-normal border-rose-500/40 text-rose-600 dark:text-rose-400">
              {outOfStockCount} out of stock
            </Badge>
            <Badge variant="outline" className="text-xs font-normal border-amber-500/40 text-amber-600 dark:text-amber-400">
              {criticalCount} critical
            </Badge>
            <Badge variant="outline" className="text-xs font-normal">
              Total shortfall: {totalShortfall} units
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <PackagePlus className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">All medicines are well stocked.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-2">
              {items.map((m, i) => {
                const stock = stockStatus(m)
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                    className="rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm">{m.name}</h3>
                          <Badge variant="outline" className={`text-xs font-normal ${stock.cls}`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${stock.dotCls}`} />
                            {stock.label}
                          </Badge>
                          {m.manufacturer && (
                            <span className="text-xs text-muted-foreground">{m.manufacturer}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="text-muted-foreground">
                            Stock: <span className="font-medium text-rose-600">{m.quantity}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Reorder at: <span className="font-medium text-foreground">{m.reorderLevel}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Shortfall: <span className="font-medium text-amber-600">{m.shortfall} units</span>
                          </span>
                          <span className="text-muted-foreground">
                            Cost: <span className="font-medium text-foreground">{formatCurrency(m.price)}/unit</span>
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-emerald-600 hover:text-emerald-700 border-emerald-500/30"
                        onClick={() => { setRestockTarget(m); setRestockQty(String(Math.max(m.shortfall, 10))) }}
                      >
                        <PackagePlus className="h-3.5 w-3.5" />
                        Restock
                      </Button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <AlertDialog open={!!restockTarget} onOpenChange={(v) => !v && setRestockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restock {restockTarget?.name}</AlertDialogTitle>
          <AlertDialogDescription>
            Current stock: {restockTarget?.quantity ?? 0} · Reorder level: {restockTarget?.reorderLevel ?? 0}. Enter the quantity to add.
          </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="restock-qty">Quantity to add</Label>
            <Input
              id="restock-qty"
              type="number"
              min={1}
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRestock} disabled={!restockQty || parseInt(restockQty, 10) <= 0}>
              <PackagePlus className="h-3.5 w-3.5" />
              Confirm restock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
