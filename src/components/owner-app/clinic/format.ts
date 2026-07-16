/** Shared formatting helpers for the clinic UI. */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatRelative(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}

/** Returns a local datetime string suitable for an <input type="datetime-local"> */
export function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Returns a local datetime string for now + N hours (default 1) */
export function defaultAppointmentTime(addHours = 1): string {
  const d = new Date()
  d.setHours(d.getHours() + addHours)
  d.setMinutes(0, 0, 0)
  return toLocalDatetimeInputValue(d)
}

/** Calculate age in years from a date of birth. Returns null if invalid/future. */
export function calculateAge(dob: string | Date | null | undefined): number | null {
  if (!dob) return null
  const d = typeof dob === 'string' ? new Date(dob) : dob
  if (isNaN(d.getTime())) return null
  const now = new Date()
  if (d.getTime() > now.getTime()) return null
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 && age < 150 ? age : null
}

/** Format a date of birth for display: "Jan 15, 1990 (35y)". */
export function formatDobWithAge(dob: string | Date | null | undefined): string {
  if (!dob) return '—'
  const d = typeof dob === 'string' ? new Date(dob) : dob
  const age = calculateAge(d)
  return `${formatDate(d)}${age != null ? ` (${age}y)` : ''}`
}

/** Convert a Date or ISO string to a value suitable for <input type="date">. */
export function toDateInputValue(dob: string | Date | null | undefined): string {
  if (!dob) return ''
  const d = typeof dob === 'string' ? new Date(dob) : dob
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
