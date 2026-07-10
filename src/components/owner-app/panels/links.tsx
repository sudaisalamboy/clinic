'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Link2, Loader2, ExternalLink, Search, Pencil, Check, X, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'

interface LinkItem {
  id: string
  title: string
  url: string
  category: string | null
  createdAt: string
}

export function LinksPanel() {
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftCategory, setDraftCategory] = useState('')
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/links')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setLinks(data.links)
    } catch {
      toast({ title: 'Failed to load links', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function createLink() {
    if (!title.trim() || !url.trim()) return
    let normalizedUrl = url.trim()
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl
    }
    setCreating(true)
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          url: normalizedUrl,
          category: category.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'create failed')
      }
      const data = await res.json()
      setLinks((prev) => [data.link, ...prev])
      setTitle('')
      setUrl('')
      setCategory('')
      toast({ title: 'Link saved' })
    } catch (e) {
      toast({
        title: 'Failed to save link',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  async function deleteLink(id: string) {
    const prev = links
    setLinks((p) => p.filter((l) => l.id !== id))
    try {
      await fetch(`/api/links/${id}`, { method: 'DELETE' })
      toast({ title: 'Link deleted' })
    } catch {
      setLinks(prev)
      toast({ title: 'Failed to delete link', variant: 'destructive' })
    }
  }

  function startEdit(link: LinkItem) {
    setEditingId(link.id)
    setDraftTitle(link.title)
    setDraftUrl(link.url)
    setDraftCategory(link.category ?? '')
  }

  async function saveEdit(id: string) {
    let normalizedUrl = draftUrl.trim()
    if (!normalizedUrl) return
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl
    }
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle.trim(),
          url: normalizedUrl,
          category: draftCategory.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      const data = await res.json()
      setLinks((prev) => prev.map((l) => (l.id === id ? data.link : l)))
      setEditingId(null)
      toast({ title: 'Link updated' })
    } catch {
      toast({ title: 'Failed to save link', variant: 'destructive' })
    }
  }

  const filtered = links.filter(
    (l) =>
      l.title.toLowerCase().includes(query.toLowerCase()) ||
      l.url.toLowerCase().includes(query.toLowerCase()) ||
      (l.category ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  // Group by category
  const groups: Record<string, LinkItem[]> = {}
  for (const l of filtered) {
    const k = l.category ?? 'Uncategorized'
    if (!groups[k]) groups[k] = []
    groups[k].push(l)
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4">
      {/* Create */}
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Save a link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="e.g. Recipe blog" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">URL</Label>
              <Input id="url" placeholder="example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat">Category (optional)</Label>
              <Input id="cat" placeholder="e.g. Reading" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <Button className="w-full" onClick={createLink} disabled={creating || !title.trim() || !url.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save link
            </Button>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search links…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Your links
            </span>
            <span className="text-xs text-muted-foreground font-normal">{filtered.length} total</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{links.length === 0 ? 'No links saved yet.' : 'No links match your search.'}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-5">
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Folder className="h-3.5 w-3.5" />
                      {cat}
                      <span className="text-muted-foreground/60">({items.length})</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {items.map((l) => (
                        <LinkCard
                          key={l.id}
                          link={l}
                          editing={editingId === l.id}
                          draftTitle={draftTitle}
                          draftUrl={draftUrl}
                          draftCategory={draftCategory}
                          onDraftTitle={setDraftTitle}
                          onDraftUrl={setDraftUrl}
                          onDraftCategory={setDraftCategory}
                          onStartEdit={() => startEdit(l)}
                          onCancelEdit={() => setEditingId(null)}
                          onSaveEdit={() => saveEdit(l.id)}
                          onDelete={() => deleteLink(l.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LinkCard({
  link,
  editing,
  draftTitle,
  draftUrl,
  draftCategory,
  onDraftTitle,
  onDraftUrl,
  onDraftCategory,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  link: LinkItem
  editing: boolean
  draftTitle: string
  draftUrl: string
  draftCategory: string
  onDraftTitle: (v: string) => void
  onDraftUrl: (v: string) => void
  onDraftCategory: (v: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete: () => void
}) {
  let host = ''
  try {
    host = new URL(link.url).hostname.replace(/^www\./, '')
  } catch {
    host = link.url
  }
  if (editing) {
    return (
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <Input value={draftTitle} onChange={(e) => onDraftTitle(e.target.value)} placeholder="Title" />
        <Input value={draftUrl} onChange={(e) => onDraftUrl(e.target.value)} placeholder="URL" />
        <Input value={draftCategory} onChange={(e) => onDraftCategory(e.target.value)} placeholder="Category" />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={onSaveEdit}>
            <Check className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>
    )
  }
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="group rounded-lg border bg-card p-3 hover:bg-accent/30 transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:underline inline-flex items-center gap-1"
          >
            {link.title}
            <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          </a>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{host}</p>
          {link.category && (
            <Badge variant="secondary" className="mt-1.5 text-xs font-normal">{link.category}</Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onStartEdit} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
