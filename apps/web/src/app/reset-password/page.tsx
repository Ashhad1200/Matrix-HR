'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showNewLink, setShowNewLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setShowNewLink(false);
    if (password.length < 8 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be 8–72 characters and include an uppercase letter, a lowercase letter, and a digit.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await api.auth.resetPassword({ token: token!, password });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset your password');
      setShowNewLink(err instanceof ApiError && err.status === 400);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">This reset link is missing its token. Request a new password reset email to continue.</p>
        <Link href="/forgot-password" className="inline-block font-medium text-brand-600 hover:underline dark:text-brand-400">Request a new link</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div data-testid="reset-success" className="mt-6 space-y-4">
        <p className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">Your password has been reset successfully.</p>
        <Link href="/login" className="inline-block font-medium text-brand-600 hover:underline dark:text-brand-400">Sign in with your new password</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium">New password</label>
        <Input id="reset-password" data-testid="reset-password-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">8–72 characters with uppercase, lowercase, and a digit.</p>
      </div>
      <div>
        <label htmlFor="reset-confirm" className="mb-1.5 block text-sm font-medium">Confirm new password</label>
        <Input id="reset-confirm" data-testid="reset-confirm-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
      </div>
      {error && (
        <div className="space-y-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          <p>{error}</p>
          {showNewLink && <Link href="/forgot-password" className="font-medium underline">Request a new link</Link>}
        </div>
      )}
      <Button data-testid="reset-submit" type="submit" className="w-full" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[hsl(var(--muted))] p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm sm:p-8">
        <Link href="/login" className="font-display text-lg font-bold text-brand-700 dark:text-brand-400">MatrixHR</Link>
        <h1 className="mt-8 font-display text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Use a strong password you have not used for this account before.</p>
        <Suspense fallback={<p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
