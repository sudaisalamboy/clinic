'use client'

import { useEffect, useRef } from 'react'

/**
 * Reusable date/datetime picker built on top of the vanilla-js-datetime-picker.
 * Loads the script + CSS from /public on first use, then attaches the picker
 * to the rendered text input.
 *
 * Props:
 *  - value: string (YYYY-MM-DD or YYYY-MM-DDTHH:mm)
 *  - onChange: (value: string) => void
 *  - withTime: boolean (default true) — show the time panel
 *  - placeholder: string
 *  - className: string
 *  - id: string (for label association)
 *  - minuteStep: number (default 5)
 */
interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  withTime?: boolean
  placeholder?: string
  className?: string
  id?: string
  minuteStep?: number
  min?: string
  max?: string
}

interface DateTimePickerOptions {
  minuteStep?: number
  format?: (date: Date) => string
  parse?: (str: string) => Date | null
  initial?: Date
  min?: string
  max?: string
  highlightToday?: boolean
}
interface DateTimePickerInstance {
  destroy?: () => void
}
interface DateTimePickerConstructor {
  new (el: HTMLInputElement, options: DateTimePickerOptions): DateTimePickerInstance
}

declare global {
  interface Window {
    DateTimePicker?: DateTimePickerConstructor
  }
}

let scriptLoaded: Promise<void> | null = null
let cssLoaded = false

function loadScript(): Promise<void> {
  if (scriptLoaded) return scriptLoaded
  scriptLoaded = new Promise((resolve, reject) => {
    if (window.DateTimePicker) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = '/datetime-picker.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load datetime picker'))
    document.head.appendChild(script)
  })
  return scriptLoaded
}

function loadCSS() {
  if (cssLoaded) return
  cssLoaded = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/datetime-picker.css'
  document.head.appendChild(link)
}

export function DatePicker({
  value,
  onChange,
  withTime = true,
  placeholder = 'Select date',
  className = '',
  id,
  minuteStep = 5,
  min,
  max,
}: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<DateTimePickerInstance | null>(null)

  // Latest-props ref: the picker is created ONCE on mount (recreating it
  // on every keystroke would flicker and drop focus), but the change
  // handler and options must still see fresh props. Writing during render
  // to a ref is safe here — it is idempotent and the value is only read
  // inside effects/handlers.
  const latest = useRef({ value, min, max, minuteStep, onChange, withTime })
  latest.current = { value, min, max, minuteStep, onChange, withTime }

  useEffect(() => {
    let cancelled = false
    // Declared in the EFFECT scope so the cleanup can reach it even after
    // React has detached the ref (ref.current is null by cleanup time).
    let el: HTMLInputElement | null = null

    loadCSS()
    loadScript()
      .then(() => {
        el = inputRef.current
        if (cancelled || !el || !window.DateTimePicker) return

        const format = withTime
          ? (date: Date) => {
              const p = (n: number) => String(n).padStart(2, '0')
              return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
            }
          : (date: Date) => {
              const p = (n: number) => String(n).padStart(2, '0')
              return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
            }

        const parse = (str: string) => {
          if (!str) return null
          const d = new Date(str)
          return isNaN(d.getTime()) ? null : d
        }

        const { value: v, min: lo, max: hi, minuteStep: step } = latest.current

        pickerRef.current = new window.DateTimePicker(el, {
          minuteStep: step,
          format,
          parse,
          initial: v ? new Date(v) : new Date(),
          min: lo || undefined,
          max: hi || undefined,
          highlightToday: true,
        })

        // Listen for changes
        el.addEventListener('change', handleChange)
      })
      .catch(() => {
        // Fallback: if script fails to load, the input still works as a plain text input
      })

    function handleChange() {
      if (inputRef.current) {
        latest.current.onChange(inputRef.current.value)
      }
    }

    return () => {
      cancelled = true
      el?.removeEventListener('change', handleChange)
      if (pickerRef.current && typeof pickerRef.current.destroy === 'function') {
        pickerRef.current.destroy()
      }
    }
    // Mount-only by design: the picker widget is expensive to (re)create
    // and loses focus when re-attached. Fresh props are read via the
    // `latest` ref, and external `value` changes sync through the effect
    // below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes into the input
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  return (
    <input
      ref={inputRef}
      type="text"
      id={id}
      defaultValue={value}
      placeholder={placeholder}
      className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      autoComplete="off"
    />
  )
}
