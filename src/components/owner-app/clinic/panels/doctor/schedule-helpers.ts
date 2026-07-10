/** Day-of-week helpers for doctor schedules. */

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** Get today's day-of-week index (0=Sun ... 6=Sat) in local time. */
export function todayDayOfWeek(): number {
  return new Date().getDay()
}

/** Format "09:00" → "9:00 AM" for display. */
export function formatTime(t: string | null | undefined): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map((n) => parseInt(n, 10))
  if (isNaN(h) || isNaN(m)) return t
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}

export interface ScheduleSlot {
  dayOfWeek: number
  startTime: string | null
  endTime: string | null
  isWorking: boolean
}

/** Returns today's schedule slot, or null if doctor has no schedule rows. */
export function todaySchedule(schedule: ScheduleSlot[]): ScheduleSlot | null {
  const today = todayDayOfWeek()
  return schedule.find((s) => s.dayOfWeek === today) ?? null
}

/** Returns true if the doctor is working today. */
export function isWorkingToday(schedule: ScheduleSlot[]): boolean {
  const t = todaySchedule(schedule)
  return !!t && t.isWorking && !!t.startTime && !!t.endTime
}
