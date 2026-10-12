'use client';

import { useBrand, useDomainSuffix } from '@/lib/brand-context';
import { useEffect, useState } from 'react';
import { currencyForCountry, currencyForTimeZone, formatMoney } from '@matrixhr/shared';
import { COUNTRIES } from '@/lib/countries';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/brand/logo';

export default function SignUpPage() {
  const brand = useBrand();
  const suffix = useDomainSuffix();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', companyName: '', subdomain: '', country: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Default the country from the visitor (edge header or geo-IP, then the browser time zone); they can change it.
  useEffect(() => {
    let live = true;
    (async () => {
      let c: string | null = null;
      try { c = (await (await fetch('/api/country')).json()).country; } catch { /* ignore */ }
      if (!c) { try { c = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Karachi' ? 'PK' : null; } catch { /* ignore */ } }
      if (live && c && COUNTRIES.some(([code]) => code === c)) setForm((f) => (f.country ? f : { ...f, country: c! }));
    })();
    return () => { live = false; };
  }, []);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'companyName') {
      const sub = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setForm((f) => ({ ...f, subdomain: sub }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.signup({ ...form, country: form.country === 'XX' ? undefined : form.country });
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[hsl(var(--muted))]/60 p-4">
      <Link href="/" aria-label={`${brand.name} home`} className="rounded-md"><Logo /></Link>
      <Card className="w-full max-w-md animate-rise">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your company</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Start your 30-day free trial</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="su-company" className="mb-1.5 block text-sm font-medium">Company name</label>
              <Input id="su-company" autoComplete="organization" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} required />
            </div>
            <div>
              <label htmlFor="su-subdomain" className="mb-1.5 block text-sm font-medium">Subdomain</label>
              <div className="flex items-center gap-2">
                <Input id="su-subdomain" value={form.subdomain} onChange={(e) => update('subdomain', e.target.value)} required />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{suffix}</span>
              </div>
            </div>
            <div>
              <label htmlFor="su-country" className="mb-1.5 block text-sm font-medium">Country</label>
              <select id="su-country" required value={form.country} onChange={(e) => update('country', e.target.value)} className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                <option value="" disabled>Choose your country</option>
                {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
              {form.country && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]" data-testid="billing-currency-hint">You will be billed in {currencyForCountry(form.country) === 'PKR' ? 'Pakistani rupees (PKR)' : 'US dollars (USD)'}.</p>}
            </div>
            <div>
              <label htmlFor="su-email" className="mb-1.5 block text-sm font-medium">Work email</label>
              <Input id="su-email" autoComplete="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            </div>
            <div>
              <label htmlFor="su-password" className="mb-1.5 block text-sm font-medium">Password</label>
              <Input id="su-password" autoComplete="new-password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
            </div>
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-400">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
