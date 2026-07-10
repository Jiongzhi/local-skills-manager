import { cn } from '../../lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  count?: number
}

export interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  className?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === option.value
              ? 'bg-card text-foreground shadow-sm'
              : 'hover:text-foreground',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-xs tabular-nums',
                value === option.value ? 'bg-muted' : 'bg-background/60',
              )}
            >
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
