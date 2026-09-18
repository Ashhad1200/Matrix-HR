'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans text-slate-950">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">MatrixHR</p>
            <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">The application hit an unexpected problem. Please try again.</p>
            {error.digest && <p className="mt-3 font-mono text-xs text-slate-500">Reference: {error.digest}</p>}
            <button type="button" onClick={reset} className="mt-6 rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
