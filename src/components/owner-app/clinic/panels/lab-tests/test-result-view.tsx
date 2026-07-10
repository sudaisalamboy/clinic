'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Upload,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
  Download,
  History,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDateTime, formatDate, calculateAge } from '../../format'
import {
  type PatientLabTest,
  type ResultValue,
  type LabTestStatus,
  STATUS_META,
  nextStatus,
  FLAG_META,
} from './lab-helpers'

interface Props {
  patientTestId: string
  onBack: () => void
  onChanged: () => void
}

export function TestResultView({ patientTestId, onBack, onChanged }: Props) {
  const { toast } = useToast()
  const [pt, setPt] = useState<PatientLabTest | null>(null)
  const [history, setHistory] = useState<PatientLabTest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  // Editable result values
  const [resultValues, setResultValues] = useState<ResultValue[]>([])
  const [resultNotes, setResultNotes] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/patient-tests/${patientTestId}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPt(data.patientTest)
      setHistory(data.history ?? [])
      setResultValues(data.patientTest.resultValues ?? [])
      setResultNotes(data.patientTest.resultNotes ?? '')
    } catch {
      toast({ title: 'Failed to load test', variant: 'destructive' })
      onBack()
    } finally {
      setLoading(false)
    }
  }, [patientTestId, toast, onBack])

  useEffect(() => { void load() }, [load])

  function addResultRow() {
    setResultValues((prev) => [...prev, { parameter: '', value: '', unit: '', flag: '' }])
  }
  function updateResultRow(i: number, patch: Partial<ResultValue>) {
    setResultValues((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function removeResultRow(i: number) {
    setResultValues((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function saveResults(markCompleted: boolean) {
    if (!pt) return
    setBusy(true)
    try {
      const res = await fetch(`/api/patient-tests/${pt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultValues: resultValues.filter((r) => r.parameter.trim()),
          resultNotes: resultNotes.trim() || null,
          status: markCompleted ? 'Completed' : 'In Progress',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setPt(data.patientTest)
      toast({ title: markCompleted ? 'Test completed' : 'Results saved' })
      onChanged()
      void load()
    } catch (e) {
      toast({
        title: 'Failed to save results',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function advanceStatus() {
    if (!pt) return
    const next = nextStatus(pt.status as LabTestStatus)
    if (!next) return
    setBusy(true)
    try {
      const res = await fetch(`/api/patient-tests/${pt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'update failed')
      setPt(data.patientTest)
      toast({ title: `Marked as ${next}` })
      onChanged()
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!pt) return
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/patient-tests/${pt.id}`, {
        method: 'PUT',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'upload failed')
      setPt(data.patientTest)
      toast({ title: 'File uploaded', description: file.name })
      onChanged()
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      // Reset the input so the same file can be re-uploaded if needed
      e.target.value = ''
    }
  }

  if (loading || !pt) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const status = pt.status as LabTestStatus
  const meta = STATUS_META[status] ?? STATUS_META.Pending
  const next = nextStatus(status)
  const isImage = pt.resultFileType?.startsWith('image/')
  const isPdf = pt.resultFileType === 'application/pdf'

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">{pt.labTest.name}</CardTitle>
                <Badge variant="outline" className={`text-xs font-normal ${meta.cls}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
                  {meta.label}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">{pt.testNumber}</Badge>
              </div>
              <CardDescription className="text-sm mt-1">
                {pt.labTest.category && `${pt.labTest.category} · `}
                {formatCurrency(pt.labTest.price)} · Requested {formatDateTime(pt.requestedAt)}
                {pt.completedAt && ` · Completed ${formatDate(pt.completedAt)}`}
              </CardDescription>
            </div>
            {next && (
              <Button size="sm" variant="outline" onClick={advanceStatus} disabled={busy} className="gap-1.5">
                {next}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: patient + test info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="font-medium">{pt.patient.name}</p>
              <p className="text-xs text-muted-foreground">{pt.patient.patientCode}</p>
              {pt.patient.dateOfBirth && (
                <p className="text-xs text-muted-foreground">
                  DOB: {formatDate(pt.patient.dateOfBirth)} ({calculateAge(pt.patient.dateOfBirth)}y)
                </p>
              )}
              {pt.patient.phone && <p className="text-xs text-muted-foreground">{pt.patient.phone}</p>}
            </CardContent>
          </Card>

          {pt.labTest.referenceRange && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Reference range</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-mono">{pt.labTest.referenceRange}</p>
                {pt.labTest.sampleType && (
                  <p className="text-xs text-muted-foreground mt-1">Sample: {pt.labTest.sampleType}</p>
                )}
              </CardContent>
            </Card>
          )}

          {pt.doctor && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Requested by</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{pt.doctor.name}</p>
                {pt.doctor.specialization && <p className="text-xs text-muted-foreground">{pt.doctor.specialization}</p>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: result entry + upload */}
        <div className="lg:col-span-2 space-y-4">
          {/* File upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" /> Result file (PDF / image)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pt.resultFile ? (
                <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isImage ? <ImageIcon className="h-4 w-4 text-violet-500" /> : <FileText className="h-4 w-4 text-rose-500" />}
                      <span className="text-sm font-medium truncate">{pt.resultFileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={pt.resultFileUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 gap-1">
                          <Download className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </a>
                      <label>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                        <Button size="sm" variant="ghost" className="h-7" asChild>
                          <span>{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Replace'}</span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  {isImage && pt.resultFileUrl && (
                    <img src={pt.resultFileUrl} alt={pt.resultFileName ?? 'Result'} className="w-full rounded-md border max-h-64 object-contain" />
                  )}
                </div>
              ) : (
                <label className="block">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <div className="rounded-md border-2 border-dashed border-muted-foreground/30 p-6 text-center hover:bg-accent/20 transition cursor-pointer">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">
                      {uploading ? 'Uploading…' : 'Click to upload result file'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPEG, PNG, GIF, WebP, TIFF — max 10 MB
                    </p>
                  </div>
                </label>
              )}
            </CardContent>
          </Card>

          {/* Result values */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Result values</CardTitle>
                <Button size="sm" variant="outline" onClick={addResultRow} className="h-7 gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {resultValues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No result values entered. Click "Add row" to enter parameter values.
                </p>
              ) : (
                resultValues.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_60px_100px_28px] gap-2 items-center">
                    <Input
                      placeholder="Parameter (e.g. Hemoglobin)"
                      value={r.parameter}
                      onChange={(e) => updateResultRow(i, { parameter: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Value"
                      value={r.value}
                      onChange={(e) => updateResultRow(i, { value: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Unit"
                      value={r.unit ?? ''}
                      onChange={(e) => updateResultRow(i, { unit: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Select
                      value={r.flag || 'none'}
                      onValueChange={(v) => updateResultRow(i, { flag: v === 'none' ? '' : v as ResultValue['flag'] })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Flag" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Abnormal">Abnormal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeResultRow(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="result-notes">Lab notes / interpretation</Label>
                <Textarea
                  id="result-notes"
                  rows={3}
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Findings, interpretation, recommendations…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveResults(false)}
                  disabled={busy}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Save (In Progress)
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveResults(true)}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Save & Complete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Patient test history */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" /> Patient test history
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[40vh] pr-3">
                  <div className="space-y-1.5">
                    {history.map((h) => {
                      const hMeta = STATUS_META[h.status as LabTestStatus] ?? STATUS_META.Pending
                      return (
                        <div key={h.id} className="rounded-md border bg-card p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{h.labTest.name}</span>
                            <Badge variant="outline" className={`text-[10px] font-normal ${hMeta.cls}`}>
                              {hMeta.label}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-0.5">
                            {formatDateTime(h.requestedAt)}
                            {h.doctor ? ` · Dr. ${h.doctor.name}` : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
