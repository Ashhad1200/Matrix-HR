'use client';

import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">We couldn&rsquo;t load this page. Please try again.</p>
        {error.digest && <p className="mt-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">Reference: {error.digest}</p>}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-soft transition-[background-color,transform] hover:bg-brand-800 active:scale-[0.98] dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[hsl(var(--border))] px-4 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
