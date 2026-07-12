'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export function SettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setForm(d))
      .catch(() => toast({ title: 'Failed to load settings', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [toast])

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setForm(data)
      toast({ title: 'Settings saved' })
    } catch (err) {
      toast({
        title: 'Save failed',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-emerald-600" />
            Clinic Settings
          </CardTitle>
          <CardDescription>Configure clinic profile and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Clinic Name</Label>
              <Input value={form.clinicName || ''} onChange={(e) => set('clinicName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={form.logo || ''} onChange={(e) => set('logo', e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Doctor Name</Label>
              <Input value={form.doctorName || ''} onChange={(e) => set('doctorName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={form.mobile || ''} onChange={(e) => set('mobile', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input value={form.gstNumber || ''} onChange={(e) => set('gstNumber', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Currency Symbol</Label>
              <Input value={form.currency || ''} onChange={(e) => set('currency', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={form.timezone || ''} onChange={(e) => set('timezone', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={form.address || ''} onChange={(e) => set('address', e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
