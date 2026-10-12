'use client';

import { useBrand } from '@/lib/brand-context';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: 'an employee', MANAGER: 'a manager', HR_MANAGER: 'an HR manager', COMPANY_ADMIN: 'a company admin' };

function AcceptInviteForm() {
  const brand = useBrand();
  const token = useSearchParams().get('token');
  const [info, setInfo] = useState<{ company: string; name: string | null; email: string; role: string } | null>(null);
  const [bad, setBad] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setBad(true); return; }
    api.invites.preview(token).then(setInfo).catch(() => setBad(true));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be 8–72 characters and include an uppercase letter, a lowercase letter, and a digit.');
      return;
    }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { await api.invites.accept(token!, password); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create your account'); }
    finally { setBusy(false); }
  }

  if (bad) {
    return (
      <div className="mt-6 space-y-3">
        <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">This invitation link is invalid, has already been used, or has expired. Ask your HR team to send you a new one.</p>
        <Link href="/login" className="inline-block font-medium text-brand-600 hover:underline dark:text-brand-400">Go to sign in</Link>
      </div>
    );
  }
  if (done) {
    return (
      <div data-testid="invite-success" className="mt-6 space-y-4">
        <p className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">Your account is ready.</p>
        <Link href="/login" className="inline-block font-medium text-brand-600 hover:underline dark:text-brand-400">Sign in with {info?.email}</Link>
      </div>
    );
  }
  if (!info) return <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Checking your invitation…</p>;

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <p className="text-sm">{info.company} has invited <strong>{info.name ?? info.email}</strong> to {brand.name} as {ROLE_LABEL[info.role] ?? 'a team member'}.</p>
      <div>
        <label htmlFor="inv-email" className="mb-1.5 block text-sm font-medium">Email</label>
        <Input id="inv-email" value={info.email} readOnly disabled />
      </div>
      <div>
        <label htmlFor="inv-password" className="mb-1.5 block text-sm font-medium">Choose a password</label>
        <Input id="inv-password" data-testid="invite-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">8–72 characters with uppercase, lowercase, and a digit.</p>
      </div>
      <div>
        <label htmlFor="inv-confirm" className="mb-1.5 block text-sm font-medium">Confirm password</label>
        <Input id="inv-confirm" data-testid="invite-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
      <Button data-testid="invite-submit" type="submit" className="w-full" disabled={busy}>{busy ? 'Creating your account…' : 'Create my account'}</Button>
    </form>
  );
}

export default function AcceptInvitePage() {
  const brand = useBrand();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[hsl(var(--muted))] p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm sm:p-8">
        <Link href="/login" className="font-display text-lg font-bold text-brand-700 dark:text-brand-400">{brand.name}</Link>
        <h1 className="mt-8 font-display text-2xl font-bold tracking-tight">Set up your account</h1>
        <Suspense fallback={<p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </main>
  );
}
