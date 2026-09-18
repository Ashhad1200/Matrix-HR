'use client';

import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">MatrixHR</p>
        <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">We couldn’t load this page. Please try again.</p>
        {error.digest && <p className="mt-3 font-mono text-xs text-slate-500">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">Try again</button>
          <Link href="/dashboard" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Go home</Link>
        </div>
      </div>
    </main>
  );
}
