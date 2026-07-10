import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'

const variantClasses: Record<Variant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  outline: 'text-foreground',
  success:
    'border-transparent bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400',
  warning:
    'border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400',
  destructive: 'border-transparent bg-destructive/15 text-destructive',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
