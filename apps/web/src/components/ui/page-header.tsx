import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 rounded text-sm font-medium text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {backLabel ?? 'Back'}
          </Link>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem] sm:leading-9">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
