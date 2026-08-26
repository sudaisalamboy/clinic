'use client'

import { motion } from 'framer-motion'

/** Animated skeleton loader with shimmer effect */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md ${className}`}
    />
  )
}

/** Skeleton for a table row */
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex gap-3 items-center"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={`h-8 ${j === 0 ? 'w-32' : j === 1 ? 'w-20' : 'flex-1'}`}
            />
          ))}
        </motion.div>
      ))}
    </div>
  )
}

/** Skeleton for KPI stat cards */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-7 w-16 mb-1" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

/** Skeleton for chart area */
export function ChartSkeleton() {
  return (
    <div className="h-72 flex items-end justify-center gap-2 px-4">
      {[40, 65, 50, 80, 60, 90, 45, 70, 55, 85, 50, 75, 60, 45].map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Skeleton className="w-full h-full min-h-[20px]" />
        </motion.div>
      ))}
    </div>
  )
}

/** Full page loading with animated dots */
export function LoadingDots({ text = 'Loading' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-xs text-muted-foreground"
      >
        {text}…
      </motion.p>
    </div>
  )
}
