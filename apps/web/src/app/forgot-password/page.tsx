'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CONFIRMATION = "If an account exists for that email, we've sent a reset link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.auth.forgotPassword({ email });
    } catch {
      // Deliberately show the same response for privacy and transient failures.
    } finally {
      setSubmitted(true);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[hsl(var(--muted))] p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm sm:p-8">
        <Link href="/login" className="font-display text-lg font-bold text-brand-700 dark:text-brand-400">MatrixHR</Link>
        <h1 className="mt-8 font-display text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Enter your work email and we’ll send instructions if an account matches it.</p>

        {submitted ? (
          <div data-testid="forgot-confirmation" className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">
            {CONFIRMATION}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium">Work email</label>
              <Input id="forgot-email" data-testid="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <Button data-testid="forgot-submit" type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Back to sign in</Link></p>
      </div>
    </main>
  );
}
