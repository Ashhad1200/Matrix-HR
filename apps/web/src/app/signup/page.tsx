'use client';

import { useBrand, useDomainSuffix } from '@/lib/brand-context';
import { useState } from 'react';
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
  const [form, setForm] = useState({ email: '', password: '', companyName: '', subdomain: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const res = await api.auth.signup(form);
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
