import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

const TINTS = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
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
    <Card className={cn('group transition-shadow hover:shadow-lifted', className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
            TINTS[tint],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
          <p className="font-display text-2xl font-bold tabular-nums leading-tight">{value}</p>
          {hint && <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
