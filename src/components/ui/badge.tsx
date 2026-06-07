import { clsx } from 'clsx'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'active'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        {
          'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300': variant === 'default',
          'border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400': variant === 'outline',
          'bg-emerald-600 text-white': variant === 'active',
        },
        className
      )}
      {...props}
    />
  )
}
