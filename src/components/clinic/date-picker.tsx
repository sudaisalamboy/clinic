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

declare global {
  interface Window {
    DateTimePicker?: any
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
  const pickerRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    loadCSS()
    loadScript()
      .then(() => {
        if (cancelled || !inputRef.current || !window.DateTimePicker) return

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

        pickerRef.current = new window.DateTimePicker(inputRef.current, {
          minuteStep,
          format,
          parse,
          initial: value ? new Date(value) : new Date(),
          min: min || undefined,
          max: max || undefined,
          highlightToday: true,
        })

        // Listen for changes
        inputRef.current.addEventListener('change', handleChange)
      })
      .catch(() => {
        // Fallback: if script fails to load, the input still works as a plain text input
      })

    function handleChange() {
      if (inputRef.current) {
        onChange(inputRef.current.value)
      }
    }

    return () => {
      cancelled = true
      if (inputRef.current) {
        inputRef.current.removeEventListener('change', handleChange)
      }
      if (pickerRef.current && typeof pickerRef.current.destroy === 'function') {
        pickerRef.current.destroy()
      }
    }
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
