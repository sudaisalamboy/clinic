'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, Settings as SettingsIcon, Palette, Building2, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

const COLOR_PRESETS = [
  { primary: '#10b981', accent: '#0d9488', name: 'Emerald' },
  { primary: '#3b82f6', accent: '#2563eb', name: 'Blue' },
  { primary: '#8b5cf6', accent: '#7c3aed', name: 'Violet' },
  { primary: '#f59e0b', accent: '#d97706', name: 'Amber' },
  { primary: '#ef4444', accent: '#dc2626', name: 'Red' },
  { primary: '#ec4899', accent: '#db2777', name: 'Pink' },
  { primary: '#14b8a6', accent: '#0d9488', name: 'Teal' },
  { primary: '#6366f1', accent: '#4f46e5', name: 'Indigo' },
  { primary: '#84cc16', accent: '#65a30d', name: 'Lime' },
  { primary: '#f97316', accent: '#ea580c', name: 'Orange' },
]

export function SettingsPanel({ onSettingsSaved }: { onSettingsSaved?: () => void }) {
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
      toast({ title: 'Settings saved', description: 'Changes are now live' })
      onSettingsSaved?.()
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
    <div className="space-y-4 max-w-4xl">
      {/* Clinic Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Clinic Profile
          </CardTitle>
          <CardDescription>These details appear in the header, bills, and reports</CardDescription>
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
              <Input value={form.currency || ''} onChange={(e) => set('currency', e.target.value)} maxLength={3} />
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
        </CardContent>
      </Card>

      {/* Theme Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-violet-600" />
            Theme Colors
          </CardTitle>
          <CardDescription>Pick 2 colors — primary for buttons/sidebar, accent for highlights</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Color presets */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {COLOR_PRESETS.map((preset) => {
              const isActive = form.primaryColor === preset.primary && form.accentColor === preset.accent
              return (
                <button
                  key={preset.name}
                  onClick={() => {
                    set('primaryColor', preset.primary)
                    set('accentColor', preset.accent)
                  }}
                  className={`rounded-lg border-2 p-3 flex flex-col items-center gap-2 transition ${
                    isActive ? 'border-foreground ring-2 ring-offset-2 ring-foreground/20' : 'border-border hover:border-foreground/30'
                  }`}
                >
                  <div className="flex gap-1">
                    <span className="h-6 w-6 rounded-full" style={{ backgroundColor: preset.primary }} />
                    <span className="h-6 w-6 rounded-full" style={{ backgroundColor: preset.accent }} />
                  </div>
                  <span className="text-xs font-medium">{preset.name}</span>
                </button>
              )
            })}
          </div>

          {/* Custom color pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor || '#10b981'}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  className="h-9 w-12 rounded-md border cursor-pointer"
                />
                <Input
                  value={form.primaryColor || '#10b981'}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor || '#0d9488'}
                  onChange={(e) => set('accentColor', e.target.value)}
                  className="h-9 w-12 rounded-md border cursor-pointer"
                />
                <Input
                  value={form.accentColor || '#0d9488'}
                  onChange={(e) => set('accentColor', e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border p-4 bg-muted/20">
            <p className="text-xs text-muted-foreground mb-3">Preview</p>
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 rounded-md text-white text-sm font-medium"
                style={{ backgroundColor: form.primaryColor || '#10b981' }}
              >
                Primary Button
              </button>
              <button
                className="px-4 py-2 rounded-md text-white text-sm font-medium"
                style={{ backgroundColor: form.accentColor || '#0d9488' }}
              >
                Accent Button
              </button>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: form.primaryColor || '#10b981' }}
              >
                Badge
              </span>
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: (form.primaryColor || '#10b981') + '20' }}
              >
                <Stethoscope className="h-4 w-4" style={{ color: form.primaryColor || '#10b981' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end sticky bottom-0 bg-background/80 backdrop-blur py-3 -mx-4 px-4 border-t">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All Changes
        </Button>
      </div>

      {/* Credit */}
      <div className="text-center py-4 text-xs text-muted-foreground">
        <p>
          Clinic Management System · Made with ❤️ by{' '}
          <a
            href="https://github.com/sudaisalamboy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-emerald-600 transition-colors"
          >
            Sudais Alam
          </a>
        </p>
        <p className="mt-1 text-[10px]">MIT License · © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
