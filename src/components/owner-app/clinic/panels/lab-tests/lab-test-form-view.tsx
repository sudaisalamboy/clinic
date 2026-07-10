'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Save,
  Loader2,
  FlaskConical,
  Pencil,
  DollarSign,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface FormData {
  name: string
  category: string
  description: string
  price: string
  referenceRange: string
  sampleType: string
  turnaroundHours: string
  status: 'Active' | 'Inactive'
}

const EMPTY: FormData = {
  name: '',
  category: '',
  description: '',
  price: '0',
  referenceRange: '',
  sampleType: '',
  turnaroundHours: '',
  status: 'Active',
}

const CATEGORIES = ['Hematology', 'Biochemistry', 'Microbiology', 'Pathology', 'Endocrinology', 'Immunology', 'Radiology', 'Cardiology', 'Other']

interface Props {
  mode: 'add' | 'edit'
  testId?: string
  onBack: () => void
  onSaved: (id: string) => void
}

export function LabTestFormView({ mode, testId, onBack, onSaved }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'edit' || !testId) return
    void (async () => {
      try {
        const res = await fetch('/api/lab-tests')
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        const t = (data.labTests as FormData[]).find((x: FormData & { id: string }) => x.id === testId)
        if (!t) throw new Error('not found')
        setForm({
          name: t.name ?? '',
          category: t.category ?? '',
          description: t.description ?? '',
          price: String(t.price ?? 0),
          referenceRange: t.referenceRange ?? '',
          sampleType: t.sampleType ?? '',
          turnaroundHours: t.turnaroundHours ? String(t.turnaroundHours) : '',
          status: (t.status as 'Active' | 'Inactive') ?? 'Active',
        })
      } catch {
        toast({ title: 'Failed to load lab test', variant: 'destructive' })
        onBack()
      } finally {
        setLoading(false)
      }
    })()
  }, [mode, testId, toast, onBack])

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

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
        category: form.category || null,
        description: form.description.trim() || null,
        price: parseFloat(form.price) || 0,
        referenceRange: form.referenceRange.trim() || null,
        sampleType: form.sampleType.trim() || null,
        turnaroundHours: form.turnaroundHours ? parseInt(form.turnaroundHours, 10) : null,
        status: form.status,
      }
      let res: Response
      if (mode === 'add') {
        res = await fetch('/api/lab-tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/lab-tests/${testId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast({ title: mode === 'add' ? 'Lab test added' : 'Lab test updated' })
      onSaved(data.labTest.id)
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
                <><FlaskConical className="h-4 w-4" /> Add lab test</>
              ) : (
                <><Pencil className="h-4 w-4" /> Edit lab test</>
              )}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Define a test in the catalog with price, reference range, and sample type.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="t-name">Name *</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Complete Blood Count"
                autoFocus={mode === 'add'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-cat">Category</Label>
              <Select value={form.category || 'none'} onValueChange={(v) => update('category', v === 'none' ? '' : v)}>
                <SelectTrigger id="t-cat"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Uncategorized —</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-sample">Sample type</Label>
              <Input
                id="t-sample"
                value={form.sampleType}
                onChange={(e) => update('sampleType', e.target.value)}
                placeholder="e.g. Blood, Urine"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-price" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Price ($)
              </Label>
              <Input
                id="t-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-turn" className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Turnaround (hours)
              </Label>
              <Input
                id="t-turn"
                type="number"
                min={0}
                value={form.turnaroundHours}
                onChange={(e) => update('turnaroundHours', e.target.value)}
                placeholder="e.g. 24"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-ref">Reference range</Label>
            <Input
              id="t-ref"
              value={form.referenceRange}
              onChange={(e) => update('referenceRange', e.target.value)}
              placeholder="e.g. 4.5-11.0 ×10^9/L"
            />
            <p className="text-xs text-muted-foreground">Normal range for the test result values.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What the test measures, preparation instructions, etc."
            />
          </div>

          {mode === 'edit' && (
            <div className="space-y-1.5">
              <Label htmlFor="t-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => update('status', v as 'Active' | 'Inactive')}>
                <SelectTrigger id="t-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !form.name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {mode === 'add' ? 'Add test' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
