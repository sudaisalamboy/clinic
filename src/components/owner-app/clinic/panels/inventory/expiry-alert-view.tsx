'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  CalendarX,
  Clock,
  Trash2,
  Pencil,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '../../format'
import { type Medicine } from './inventory-helpers'

interface Props {
  refreshKey: number
  onEdit: (id: string) => void
}

interface ExpiringItem extends Medicine {
  daysToExpiry: number
}
interface ExpiredItem extends Medicine {
  daysSinceExpiry: number
}

export function ExpiryAlertView({ refreshKey, onEdit }: Props) {
  const { toast } = useToast()
  const [expiring, setExpiring] = useState<ExpiringItem[]>([])
  const [expired, setExpired] = useState<ExpiredItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/medicines/alerts')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setExpiring(data.expiringSoon)
      setExpired(data.expired)
    } catch {
      toast({ title: 'Failed to load expiry alerts', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load, refreshKey])

  async function deleteMed(id: string, name: string) {
    try {
      await fetch(`/api/medicines/${id}`, { method: 'DELETE' })
      toast({ title: `${name} deleted` })
      void load()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarX className="h-4 w-4 text-rose-500" />
          Expiry alerts
        </CardTitle>
        <CardDescription className="text-sm">
          Medicines expiring soon (within 30 days) or already expired. Dispose of expired stock safely.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : expiring.length === 0 && expired.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarX className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No expiry alerts. All medicines are within their shelf life.</p>
          </div>
        ) : (
          <Tabs defaultValue={expired.length > 0 ? 'expired' : 'expiring'}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="expired" className="gap-1.5">
                <CalendarX className="h-3.5 w-3.5" />
                Expired ({expired.length})
              </TabsTrigger>
              <TabsTrigger value="expiring" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Expiring soon ({expiring.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="expired" className="mt-0">
              {expired.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No expired medicines.</p>
              ) : (
                <ScrollArea className="max-h-[60vh] pr-3">
                  <div className="space-y-2">
                    {expired.map((m, i) => (
                      <motion.div
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.2) }}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-sm">{m.name}</h3>
                              <Badge variant="outline" className="text-xs font-normal border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-500/10">
                                Expired {m.daysSinceExpiry}d ago
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span>Expired: {formatDate(m.expiryDate!)}</span>
                              <span>Stock: {m.quantity} units</span>
                              <span>Value: {formatCurrency(m.quantity * m.price)}</span>
                              {m.batchNumber && <span>Batch: {m.batchNumber}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(m.id)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMed(m.id, m.name)}
                              title="Dispose / delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="expiring" className="mt-0">
              {expiring.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No medicines expiring soon.</p>
              ) : (
                <ScrollArea className="max-h-[60vh] pr-3">
                  <div className="space-y-2">
                    {expiring.map((m, i) => {
                      const urgent = m.daysToExpiry <= 7
                      return (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.2) }}
                          className={`rounded-lg border p-3 ${
                            urgent ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-sm">{m.name}</h3>
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-normal ${
                                    urgent
                                      ? 'border-rose-500/50 text-rose-600 dark:text-rose-400'
                                      : 'border-amber-500/40 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  <Clock className="h-3 w-3" />
                                  {m.daysToExpiry === 0 ? 'Expires today' : `Expires in ${m.daysToExpiry}d`}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                <span>Expiry: {formatDate(m.expiryDate!)}</span>
                                <span>Stock: {m.quantity} units</span>
                                <span>Value: {formatCurrency(m.quantity * m.price)}</span>
                                {m.manufacturer && <span>{m.manufacturer}</span>}
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(m.id)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
