import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <Link href="/" aria-label="MatrixHR home" className="rounded-md">
        <Logo />
      </Link>
      <div className="w-full max-w-md text-center">
        <p className="font-display text-7xl font-bold tabular-nums tracking-tighter text-brand-700/25 dark:text-brand-400/25">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">The page you&rsquo;re looking for may have moved or no longer exists.</p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-soft transition-[background-color,transform] hover:bg-brand-800 active:scale-[0.98] dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
