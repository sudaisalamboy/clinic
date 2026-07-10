'use client'

import { useEffect, useState } from 'react'
import { Loader2, ReceiptText, Plus, Trash2, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useQuickActions } from './quick-actions-context'
import { formatCurrency } from './format'

interface PatientOption {
  id: string
  name: string
  phone?: string | null
}

interface MedicineOption {
  id: string
  name: string
  price: number
  quantity: number
}

interface Props {
  patients: PatientOption[]
  medicines: MedicineOption[]
  onGenerated?: () => void
}

interface LineItem {
  name: string
  qty: number
  price: number
}

export function GenerateBillDialog({ patients, medicines, onGenerated }: Props) {
  const { open, openAction, close } = useQuickActions()
  const isOpen = open === 'generate-bill'
  const { toast } = useToast()

  const [patientId, setPatientId] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { name: 'Consultation', qty: 1, price: 50 },
  ])
  const [status, setStatus] = useState<'pending' | 'paid'>('pending')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPatientId(patients[0]?.id ?? '')
      setItems([{ name: 'Consultation', qty: 1, price: 50 }])
      setStatus('pending')
      setError(null)
    }
  }, [isOpen, patients])

  const total = items.reduce((s, it) => s + it.qty * it.price, 0)

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }
  function addItem() {
    setItems((prev) => [...prev, { name: '', qty: 1, price: 0 }])
  }

  function addMedicine(medId: string) {
    const med = medicines.find((m) => m.id === medId)
    if (!med) return
    setItems((prev) => [
      ...prev,
      { name: med.name, qty: 1, price: med.price },
    ])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Please select a patient')
      return
    }
    const cleaned = items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name && it.qty > 0)
    if (cleaned.length === 0) {
      setError('Add at least one line item')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          items: cleaned,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate bill')
      toast({
        title: 'Bill generated',
        description: `${formatCurrency(data.bill.total)} · ${data.bill.status}`,
      })
      onGenerated?.()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate bill')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4" />
            Generate bill
          </DialogTitle>
          <DialogDescription>
            Create an itemized bill for a patient. Adding medicines will auto-deduct from inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-patient">Patient</Label>
            <div className="flex gap-2">
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="b-patient" className="flex-1">
                  <SelectValue placeholder={patients.length === 0 ? 'No patients yet' : 'Select patient'} />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.phone ? ` · ${p.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Add a new patient first"
                onClick={() => openAction('add-patient')}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              {medicines.length > 0 && (
                <Select onValueChange={addMedicine}>
                  <SelectTrigger className="h-7 w-[200px] text-xs">
                    <SelectValue placeholder="+ Add medicine" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.quantity} in stock) — {formatCurrency(m.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2 rounded-md border p-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_90px_28px] gap-2 items-center">
                  <Input
                    placeholder="Item name"
                    value={it.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => updateItem(i, { qty: parseInt(e.target.value || '1', 10) })}
                    title="Quantity"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.price}
                    onChange={(e) => updateItem(i, { price: parseFloat(e.target.value || '0') })}
                    title="Unit price"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeItem(i)}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                <Plus className="h-3.5 w-3.5" />
                Add line item
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="b-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'pending' | 'paid')}>
                <SelectTrigger id="b-status" className="w-[120px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm">
              Total: <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !patientId || items.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
              Generate bill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
