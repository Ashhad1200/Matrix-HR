import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline';

const STYLES: Record<Variant, string> = {
  default: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
  neutral: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  outline: 'border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]',
};

export function Badge({
  variant = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Maps common backend status strings to a badge variant. */
export function statusVariant(status?: string | null): Variant {
  const s = (status ?? '').toLowerCase();
  if (['approved', 'active', 'connected', 'completed', 'signed', 'open', 'paid', 'present'].includes(s)) return 'success';
  if (['pending', 'submitted', 'in_progress', 'scheduled', 'draft_pending', 'probation'].includes(s)) return 'warning';
  if (['rejected', 'terminated', 'cancelled', 'declined', 'failed', 'absent', 'closed'].includes(s)) return 'danger';
  if (['draft', 'disconnected', 'archived', 'expired'].includes(s)) return 'neutral';
  if (['sent', 'invited', 'review'].includes(s)) return 'info';
  return 'neutral';
}
