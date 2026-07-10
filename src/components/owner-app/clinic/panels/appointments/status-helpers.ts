/** Appointment status helpers shared across views. */

export type ApptStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'Checked-In'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'

export const ALL_STATUSES: ApptStatus[] = [
  'Scheduled',
  'Confirmed',
  'Checked-In',
  'Completed',
  'Cancelled',
  'No Show',
]

/** Linear flow statuses (the "happy path"). Cancelled and No Show are terminal off-ramps. */
export const FLOW_STATUSES: ApptStatus[] = [
  'Scheduled',
  'Confirmed',
  'Checked-In',
  'Completed',
]

export const STATUS_META: Record<
  ApptStatus,
  { label: string; cls: string; dotCls: string; icon: string }
> = {
  Scheduled: {
    label: 'Scheduled',
    cls: 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/5',
    dotCls: 'bg-sky-500',
    icon: 'calendar',
  },
  Confirmed: {
    label: 'Confirmed',
    cls: 'border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/5',
    dotCls: 'bg-violet-500',
    icon: 'check',
  },
  'Checked-In': {
    label: 'Checked-In',
    cls: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5',
    dotCls: 'bg-amber-500',
    icon: 'user-check',
  },
  Completed: {
    label: 'Completed',
    cls: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5',
    dotCls: 'bg-emerald-500',
    icon: 'circle-check',
  },
  Cancelled: {
    label: 'Cancelled',
    cls: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5',
    dotCls: 'bg-rose-500',
    icon: 'x',
  },
  'No Show': {
    label: 'No Show',
    cls: 'border-slate-500/40 text-slate-600 dark:text-slate-400 bg-slate-500/5',
    dotCls: 'bg-slate-500',
    icon: 'user-x',
  },
}

/** Returns the next status in the flow, or null if terminal. */
export function nextStatus(s: ApptStatus): ApptStatus | null {
  const idx = FLOW_STATUSES.indexOf(s)
  if (idx === -1 || idx === FLOW_STATUSES.length - 1) return null
  return FLOW_STATUSES[idx + 1]
}

/** Returns the previous status in the flow, or null if terminal/first. */
export function prevStatus(s: ApptStatus): ApptStatus | null {
  const idx = FLOW_STATUSES.indexOf(s)
  if (idx <= 0) return null
  return FLOW_STATUSES[idx - 1]
}

export function isTerminal(s: ApptStatus): boolean {
  return s === 'Completed' || s === 'Cancelled' || s === 'No Show'
}

export function isFlowStatus(s: ApptStatus): boolean {
  return FLOW_STATUSES.includes(s)
}
