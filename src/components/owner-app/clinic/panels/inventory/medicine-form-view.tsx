'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Loader2,
  Package,
  Pencil,
  DollarSign,
  Percent,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '../../format'
import { marginPercent } from './inventory-helpers'

interface MedicineFormData {
  name: string
  genericName: string
  sku: string
  manufacturer: string
  batchNumber: string
  quantity: string
  price: string
  purchasePrice: string
  reorderLevel: string
  expiryDate: string
  description: string
}

const EMPTY: MedicineFormData = {
  name: '',
  genericName: '',
  sku: '',
  manufacturer: '',
  batchNumber: '',
  quantity: '0',
  price: '0',
  purchasePrice: '0',
  reorderLevel: '10',
  expiryDate: '',
  description: '',
}

interface Props {
  mode: 'add' | 'edit'
  medicineId?: string
  onBack: () => void
  onSaved: (id: string) => void
}

export function MedicineFormView({ mode, medicineId, onBack, onSaved }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<MedicineFormData>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'edit' || !medicineId) return
    void (async () => {
      try {
        const res = await fetch(`/api/medicines?q=`)
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        const m = (data.medicines as Array<{ id: string } & MedicineFormData & { expiryDate: string | null }>).find((x) => x.id === medicineId)
        if (!m) throw new Error('not found')
        setForm({
          name: m.name,
          genericName: m.genericName ?? '',
          sku: m.sku ?? '',
          manufacturer: m.manufacturer ?? '',
          batchNumber: m.batchNumber ?? '',
          quantity: m.quantity,
          price: m.price,
          purchasePrice: m.purchasePrice,
          reorderLevel: m.reorderLevel,
          expiryDate: m.expiryDate ? m.expiryDate.slice(0, 10) : '',
          description: m.description ?? '',
        })
      } catch {
        toast({ title: 'Failed to load medicine', variant: 'destructive' })
        onBack()
      } finally {
        setLoading(false)
      }
    })()
  }, [mode, medicineId, toast, onBack])

  function update<K extends keyof MedicineFormData>(key: K, value: MedicineFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const sellingPrice = parseFloat(form.price) || 0
  const purchasePrice = parseFloat(form.purchasePrice) || 0
  const quantity = parseInt(form.quantity, 10) || 0
  const margin = purchasePrice > 0 ? Math.round(((sellingPrice - purchasePrice) / purchasePrice) * 100) : null
  const inventoryValue = quantity * sellingPrice
  const inventoryCost = quantity * purchasePrice

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        genericName: form.genericName.trim() || null,
        sku: form.sku.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        batchNumber: form.batchNumber.trim() || null,
        quantity: parseInt(form.quantity, 10) || 0,
        price: parseFloat(form.price) || 0,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        reorderLevel: parseInt(form.reorderLevel, 10) || 0,
        expiryDate: form.expiryDate || null,
        description: form.description.trim() || null,
      }
      let res: Response
      if (mode === 'add') {
        res = await fetch('/api/medicines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/medicines/${medicineId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast({ title: mode === 'add' ? 'Medicine added' : 'Medicine updated' })
      onSaved(data.medicine.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {mode === 'add' ? (
                <><Package className="h-4 w-4" /> Add new medicine</>
              ) : (
                <><Pencil className="h-4 w-4" /> Edit medicine</>
              )}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Track stock, purchase/selling price, expiry, and reorder level.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6 max-w-2xl">
          {/* Identification */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identification</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-name">Name *</Label>
                <Input
                  id="m-name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Brand name, e.g. Tylenol"
                  autoFocus={mode === 'add'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-generic">Generic name</Label>
                <Input
                  id="m-generic"
                  value={form.genericName}
                  onChange={(e) => update('genericName', e.target.value)}
                  placeholder="e.g. Acetaminophen"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-sku">SKU</Label>
                <Input
                  id="m-sku"
                  value={form.sku}
                  onChange={(e) => update('sku', e.target.value)}
                  placeholder="MED-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-manuf">Manufacturer</Label>
                <Input
                  id="m-manuf"
                  value={form.manufacturer}
                  onChange={(e) => update('manufacturer', e.target.value)}
                  placeholder="e.g. Johnson & Johnson"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-batch">Batch number</Label>
                <Input
                  id="m-batch"
                  value={form.batchNumber}
                  onChange={(e) => update('batchNumber', e.target.value)}
                  placeholder="e.g. BN-2026-001"
                />
              </div>
            </div>
          </section>

          {/* Stock */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-qty">Quantity on hand</Label>
                <Input
                  id="m-qty"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => update('quantity', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-reorder">Reorder level</Label>
                <Input
                  id="m-reorder"
                  type="number"
                  min={0}
                  value={form.reorderLevel}
                  onChange={(e) => update('reorderLevel', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Alert fires when stock drops below this.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-expiry">Expiry date</Label>
                <Input
                  id="m-expiry"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => update('expiryDate', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Pricing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-purchase">Purchase (cost) price ($)</Label>
                <Input
                  id="m-purchase"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) => update('purchasePrice', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-price">Selling price ($)</Label>
                <Input
                  id="m-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => update('price', e.target.value)}
                />
              </div>
            </div>
            {/* Live pricing summary */}
            <div className="rounded-lg border bg-muted/20 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Margin
                </p>
                <p className={`font-semibold ${margin != null && margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {margin != null ? `${margin >= 0 ? '+' : ''}${margin}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Per-unit profit</p>
                <p className="font-semibold tabular-nums">{formatCurrency(sellingPrice - purchasePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inventory cost</p>
                <p className="font-semibold tabular-nums">{formatCurrency(inventoryCost)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inventory value</p>
                <p className="font-semibold tabular-nums">{formatCurrency(inventoryValue)}</p>
              </div>
            </div>
          </section>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Description / notes</Label>
            <Textarea
              id="m-desc"
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Dosage, storage instructions, etc."
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {mode === 'add' ? 'Add medicine' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
