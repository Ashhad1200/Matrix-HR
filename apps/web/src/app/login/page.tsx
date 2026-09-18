'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError, type AuthSession } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, CalendarCheck, Wallet, LineChart } from 'lucide-react';

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@acme.com' },
  { label: 'Manager', email: 'ali.khan@acme.com' },
  { label: 'Employee', email: 'sara.ahmed@acme.com' },
];

const FEATURES = [
  { icon: Users, text: 'One directory for every employee record' },
  { icon: CalendarCheck, text: 'Leave, attendance & timesheets that approve themselves' },
  { icon: Wallet, text: 'Payroll engines for PK, US and 150+ EOR countries' },
  { icon: LineChart, text: 'Reports, eNPS and 360s your leadership will read' },
];

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === undefined
  ? process.env.NODE_ENV !== 'production'
  : process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_MODE ? 'admin@acme.com' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'Password123!' : '');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function finishLogin(session: AuthSession) {
    localStorage.setItem('accessToken', session.accessToken);
    localStorage.setItem('refreshToken', session.refreshToken);
    router.push('/dashboard');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.login({ email, password });
      if ('mfaRequired' in res) {
        setMfaToken(res.mfaToken);
        setMfaCode('');
      } else {
        finishLogin(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      finishLogin(await api.auth.verifyMfa({ mfaToken, code: mfaCode.trim() }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      if (err instanceof ApiError && err.status === 401 && /expired/i.test(message)) {
        setMfaToken('');
        setMfaCode('');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-[#0c3526] to-brand-800 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-display text-lg font-bold backdrop-blur">
            M
          </div>
          <span className="font-display text-xl font-bold tracking-tight">MatrixHR</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
            The HR operating system your people will actually enjoy.
          </h1>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">Multi-tenant · Role-based portals · Open REST API</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-lg font-bold text-white">
              M
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {mfaToken ? 'Verify your sign-in' : 'Welcome back'}
          </h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {mfaToken ? 'Enter a code from your authenticator app or a recovery code' : 'Sign in to your workspace'}
          </p>

          {mfaToken ? (
            <form onSubmit={handleMfaSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="mfa-code" className="mb-1.5 block text-sm font-medium">Authentication code or recovery code</label>
                <Input
                  id="mfa-code"
                  data-testid="mfa-code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <p data-testid="login-error" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>
              )}
              <Button data-testid="mfa-verify" type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify'}
              </Button>
              <button
                type="button"
                className="w-full text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                onClick={() => { setMfaToken(''); setMfaCode(''); setError(''); }}
              >
                Back
              </button>
            </form>
          ) : <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">Work email</label>
              <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium">Password</label>
                <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Forgot password?</Link>
              </div>
              <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && (
              <p data-testid="login-error" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>}

          {DEMO_MODE && !mfaToken && <div className="mt-6">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Demo accounts
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => { setEmail(u.email); setPassword('Password123!'); }}
                  className="rounded-lg border border-[hsl(var(--border))] px-2 py-1.5 text-xs font-medium transition-colors hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950"
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>}

          <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No account?{' '}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Create company
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
