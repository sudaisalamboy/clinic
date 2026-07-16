'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Pin, PinOff, Loader2, StickyNote, Search, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Note {
  id: string
  title: string
  content: string
  pinned: boolean
  updatedAt: string
}

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setNotes(data.notes)
    } catch {
      toast({ title: 'Failed to load notes', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function createNote() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent }),
      })
      if (!res.ok) throw new Error('create failed')
      const data = await res.json()
      setNotes((prev) => [data.note, ...prev])
      setNewTitle('')
      setNewContent('')
      toast({ title: 'Note created' })
    } catch {
      toast({ title: 'Failed to create note', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function togglePin(note: Note) {
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)),
    )
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !note.pinned }),
      })
    } catch {
      // revert
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, pinned: note.pinned } : n)),
      )
      toast({ title: 'Failed to update note', variant: 'destructive' })
    }
  }

  async function deleteNote(id: string) {
    const prev = notes
    setNotes((p) => p.filter((n) => n.id !== id))
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      toast({ title: 'Note deleted' })
    } catch {
      setNotes(prev)
      toast({ title: 'Failed to delete note', variant: 'destructive' })
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setDraftTitle(note.title)
    setDraftContent(note.content)
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draftTitle.trim(), content: draftContent }),
      })
      if (!res.ok) throw new Error('save failed')
      const data = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === id ? data.note : n)))
      setEditingId(null)
      toast({ title: 'Note saved' })
    } catch {
      toast({ title: 'Failed to save note', variant: 'destructive' })
    }
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(query.toLowerCase()) ||
      n.content.toLowerCase().includes(query.toLowerCase()),
  )
  const pinned = filtered.filter((n) => n.pinned)
  const others = filtered.filter((n) => !n.pinned)

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4">
      {/* Create + search */}
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void createNote()
              }}
            />
            <Textarea
              placeholder="Write something…"
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <Button className="w-full" onClick={createNote} disabled={creating || !newTitle.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add note
            </Button>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Your notes
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
              <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{notes.length === 0 ? 'No notes yet.' : 'No notes match your search.'}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-4">
                {pinned.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pinned</p>
                    {pinned.map((n) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        editing={editingId === n.id}
                        draftTitle={draftTitle}
                        draftContent={draftContent}
                        onDraftTitle={setDraftTitle}
                        onDraftContent={setDraftContent}
                        onStartEdit={() => startEdit(n)}
                        onCancelEdit={() => setEditingId(null)}
                        onSaveEdit={() => saveEdit(n.id)}
                        onTogglePin={() => togglePin(n)}
                        onDelete={() => deleteNote(n.id)}
                      />
                    ))}
                  </div>
                )}
                {pinned.length > 0 && others.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Others</p>
                )}
                {others.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    editing={editingId === n.id}
                    draftTitle={draftTitle}
                    draftContent={draftContent}
                    onDraftTitle={setDraftTitle}
                    onDraftContent={setDraftContent}
                    onStartEdit={() => startEdit(n)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={() => saveEdit(n.id)}
                    onTogglePin={() => togglePin(n)}
                    onDelete={() => deleteNote(n.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NoteCard({
  note,
  editing,
  draftTitle,
  draftContent,
  onDraftTitle,
  onDraftContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onTogglePin,
  onDelete,
}: {
  note: Note
  editing: boolean
  draftTitle: string
  draftContent: string
  onDraftTitle: (v: string) => void
  onDraftContent: (v: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  const updated = new Date(note.updatedAt)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-lg border bg-card p-3"
    >
      {editing ? (
        <div className="space-y-2">
          <Input value={draftTitle} onChange={(e) => onDraftTitle(e.target.value)} />
          <Textarea value={draftContent} onChange={(e) => onDraftContent(e.target.value)} rows={4} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit}>
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {note.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />}
                <h3 className="font-medium text-sm truncate">{note.title}</h3>
              </div>
              {note.content && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                  {note.content}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-2">
                Updated {updated.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onTogglePin} title={note.pinned ? 'Unpin' : 'Pin'}>
                {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onStartEdit} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
