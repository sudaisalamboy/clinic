/** Inventory helpers shared across views. */

export interface Medicine {
  id: string
  name: string
  genericName: string | null
  sku: string | null
  manufacturer: string | null
  batchNumber: string | null
  quantity: number
  price: number
  purchasePrice: number
  reorderLevel: number
  expiryDate: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

/** Returns "Out of stock" | "Critical" | "Low" | "Healthy" based on quantity vs reorder level. */
export function stockStatus(m: Pick<Medicine, 'quantity' | 'reorderLevel'>): {
  label: string
  cls: string
  dotCls: string
} {
  if (m.quantity <= 0) {
    return {
      label: 'Out of stock',
      cls: 'border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-500/5',
      dotCls: 'bg-rose-500',
    }
  }
  const ratio = m.reorderLevel > 0 ? m.quantity / m.reorderLevel : 1
  if (ratio < 0.5) {
    return {
      label: 'Critical',
      cls: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5',
      dotCls: 'bg-rose-500',
    }
  }
  if (ratio < 1) {
    return {
      label: 'Low',
      cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5',
      dotCls: 'bg-amber-500',
    }
  }
  return {
    label: 'Healthy',
    cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
    dotCls: 'bg-emerald-500',
  }
}

/** Returns expiry status for a medicine. */
export function expiryStatus(m: Pick<Medicine, 'expiryDate'>): {
  label: string
  cls: string
  days: number | null
} {
  if (!m.expiryDate) {
    return { label: 'No expiry', cls: 'border-muted text-muted-foreground', days: null }
  }
  const expiry = new Date(m.expiryDate)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
  if (days < 0) {
    return {
      label: `Expired ${Math.abs(days)}d ago`,
      cls: 'border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-500/5',
      days,
    }
  }
  if (days <= 30) {
    return {
      label: `Expires in ${days}d`,
      cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5',
      days,
    }
  }
  return {
    label: `Expires in ${days}d`,
    cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
    days,
  }
}

/** Margin = selling - purchase, as a percentage of purchase. */
export function marginPercent(m: Pick<Medicine, 'price' | 'purchasePrice'>): number | null {
  if (m.purchasePrice <= 0) return null
  return Math.round(((m.price - m.purchasePrice) / m.purchasePrice) * 100)
}
