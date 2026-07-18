'use client'

import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'search' | 'error' | 'success'
}

const VARIANTS = {
  default: { color: '#94a3b8', bg: 'bg-slate-100' },
  search: { color: '#6366f1', bg: 'bg-indigo-100' },
  error: { color: '#ef4444', bg: 'bg-rose-100' },
  success: { color: '#10b981', bg: 'bg-emerald-100' },
}

export function EmptyState({
  icon,
  title = 'No items found',
  description = 'Add something to get started',
  action,
  variant = 'default',
}: EmptyStateProps) {
  const v = VARIANTS[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      {/* Animated character */}
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 12 }}
        className="relative mb-4"
      >
        {/* Floating circle background */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={`h-20 w-20 rounded-full ${v.bg} flex items-center justify-center`}
        >
          {icon || (
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              {/* Cute character - a box with a face */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <rect x="8" y="10" width="24" height="22" rx="4" fill={v.color} fillOpacity="0.3" stroke={v.color} strokeWidth="1.5" />
                <motion.circle
                  cx="16" cy="19" r="1.5" fill={v.color}
                  animate={{ scaleY: [1, 0.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  style={{ transformOrigin: '16px 19px' }}
                />
                <motion.circle
                  cx="24" cy="19" r="1.5" fill={v.color}
                  animate={{ scaleY: [1, 0.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  style={{ transformOrigin: '24px 19px' }}
                />
                <motion.path
                  d="M15 25 Q20 27 25 25"
                  stroke={v.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                  animate={{ pathLength: [0, 1] }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                />
              </motion.g>
            </svg>
          )}
        </motion.div>

        {/* Floating dots around the character */}
        {[0, 120, 240].map((angle, i) => (
          <motion.div
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{
              backgroundColor: v.color,
              top: '50%',
              left: '50%',
            }}
            animate={{
              x: [Math.cos((angle * Math.PI) / 180) * 45, Math.cos((angle * Math.PI) / 180) * 50, Math.cos((angle * Math.PI) / 180) * 45],
              y: [Math.sin((angle * Math.PI) / 180) * 45, Math.sin((angle * Math.PI) / 180) * 50, Math.sin((angle * Math.PI) / 180) * 45],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>

      {/* Title with typing-like reveal */}
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-sm font-semibold text-foreground"
      >
        {title}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-xs text-muted-foreground mt-1 max-w-xs"
      >
        {description}
      </motion.p>

      {/* Action button */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-4"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}
