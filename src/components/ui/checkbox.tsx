import { Check, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface CheckboxProps {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  ...props
}: CheckboxProps) {
  const active = checked === true || checked === 'indeterminate'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
      aria-label={props['aria-label']}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onCheckedChange(checked !== true)
      }}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
        className,
      )}
    >
      {checked === 'indeterminate' ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : checked ? (
        <Check className="h-3 w-3" strokeWidth={3} />
      ) : null}
    </button>
  )
}
