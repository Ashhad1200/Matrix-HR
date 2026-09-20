import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

/**
 * One accent, two signals: brand for normal, amber for "needs attention".
 * sky/violet/rose stay accepted so existing pages compile unchanged, but render as the calm brand chip.
 */
const TINTS = {
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  sky: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300',
  rose: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300',
  violet: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300',
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tint = 'brand',
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tint?: keyof typeof TINTS;
  className?: string;
}) {
  return (
    <Card className={cn('group h-full transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lifted', className)}>
      <CardContent className="flex h-full items-stretch justify-between gap-3 p-5">
        <div className="flex min-w-0 flex-col justify-between gap-3">
          <p className="text-sm leading-snug text-[hsl(var(--muted-foreground))]">{label}</p>
          <div className="min-w-0">
            <p className="truncate font-display text-3xl font-bold tabular-nums leading-none tracking-tight">{value}</p>
            {hint && <p className="mt-2 truncate text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}
          </div>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 self-start items-center justify-center rounded-lg', TINTS[tint])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
