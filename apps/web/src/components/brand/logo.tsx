import { cn } from '@/lib/utils';

/** Four-cell "matrix" mark: one cell lit, three quiet. Tinted by the brand token so it works in both themes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8', className)}>
      <rect x="2" y="2" width="13" height="13" rx="4" className="fill-brand-700 dark:fill-brand-400" />
      <rect x="17" y="2" width="13" height="13" rx="4" className="fill-brand-700/30 dark:fill-brand-400/30" />
      <rect x="2" y="17" width="13" height="13" rx="4" className="fill-brand-700/30 dark:fill-brand-400/30" />
      <rect x="17" y="17" width="13" height="13" rx="4" className="fill-brand-700/60 dark:fill-brand-400/60" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-[1.15rem] font-bold tracking-tight">MatrixHR</span>
    </span>
  );
}
