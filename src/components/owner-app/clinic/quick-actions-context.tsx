'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type QuickAction = 'add-patient' | 'book-appointment' | 'generate-bill' | null

interface QuickActionsCtx {
  open: QuickAction
  openAction: (a: Exclude<QuickAction, null>) => void
  close: () => void
}

const Ctx = createContext<QuickActionsCtx | null>(null)

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<QuickAction>(null)
  const openAction = useCallback((a: Exclude<QuickAction, null>) => setOpen(a), [])
  const close = useCallback(() => setOpen(null), [])
  return (
    <Ctx.Provider value={{ open, openAction, close }}>
      {children}
    </Ctx.Provider>
  )
}

export function useQuickActions() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useQuickActions must be used inside QuickActionsProvider')
  return v
}
