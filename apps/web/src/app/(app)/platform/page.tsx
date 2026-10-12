'use client';

import { useBrand, useDomainSuffix } from '@/lib/brand-context';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Users, UserCheck, CircleCheck, Plus, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trialing: 'neutral',
  past_due: 'warning',
  suspended: 'danger',
  cancelled: 'danger',
  expired: 'danger',
  unsubscribed: 'neutral',
};

const emptyForm = { companyName: '', subdomain: '', adminEmail: '', adminPassword: '', planCode: '' };

function NewTenantModal({ plans, onClose, onCreated }: { plans: any[]; onClose: () => void; onCreated: () => void }) {
  const suffix = useDomainSuffix();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ tenant: any; admin: any } | null>(null);
  const [copied, setCopied] = useState(false);

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.platform.createTenant({
        companyName: form.companyName,
        subdomain: form.subdomain,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword || undefined,
        planCode: form.planCode || undefined,
      });
      setResult(res);
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create tenant');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const generated = result.admin?.generatedPassword;
    const credentials = `${result.admin.email}${generated ? `\n${generated}` : ''}`;
    return (
      <Modal open onClose={onClose} title="Tenant created" description={result.tenant.name}>
        <div className="space-y-4">
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/60 p-4 text-sm">
            <p className="flex justify-between gap-4"><span className="text-[hsl(var(--muted-foreground))]">Admin email</span><span className="font-mono">{result.admin.email}</span></p>
            {generated && (
              <p className="mt-2 flex justify-between gap-4"><span className="text-[hsl(var(--muted-foreground))]">Password</span><span className="font-mono">{generated}</span></p>
            )}
          </div>
          {generated && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              This password is shown once and was not stored anywhere. Copy it now and hand it to the client.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(credentials).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy credentials'}
            </Button>
            <Button type="button" className="flex-1" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="New tenant" description="Creates the company and its first admin account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nt-company" className="mb-1.5 block text-sm font-medium">Company name</label>
          <Input
            id="nt-company"
            required
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value, subdomain: f.subdomain || slugify(e.target.value) }))}
          />
        </div>
        <div>
          <label htmlFor="nt-subdomain" className="mb-1.5 block text-sm font-medium">Subdomain</label>
          <div className="flex items-center gap-2">
            <Input id="nt-subdomain" required value={form.subdomain} onChange={(e) => setForm((f) => ({ ...f, subdomain: e.target.value }))} />
            <span className="shrink-0 text-sm text-[hsl(var(--muted-foreground))]">{suffix}</span>
          </div>
        </div>
        <div>
          <label htmlFor="nt-email" className="mb-1.5 block text-sm font-medium">Admin email</label>
          <Input id="nt-email" type="email" autoComplete="off" required value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="nt-password" className="mb-1.5 block text-sm font-medium">Admin password</label>
          <Input
            id="nt-password"
            type="text"
            autoComplete="off"
            placeholder="Leave blank to generate one"
            value={form.adminPassword}
            onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="nt-plan" className="mb-1.5 block text-sm font-medium">Starting plan</label>
          <select
            id="nt-plan"
            className="input-base"
            value={form.planCode}
            onChange={(e) => setForm((f) => ({ ...f, planCode: e.target.value }))}
          >
            <option value="">None (assign later)</option>
            {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create tenant'}</Button>
      </form>
    </Modal>
  );
}

export default function PlatformTenantsPage() {
  const brand = useBrand();
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  function load() {
    return Promise.all([api.platform.tenants(), api.platform.plans()])
      .then(([t, p]) => { setTenants(t); setPlans(p); })
      .catch((err) => setError(err.message || 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.subscriptionStatus === 'active').length;
    return {
      tenants: tenants.length,
      active,
      employees: tenants.reduce((sum, t) => sum + (t.employeeCount ?? 0), 0),
      users: tenants.reduce((sum, t) => sum + (t.userCount ?? 0), 0),
    };
  }, [tenants]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description={`Every company on ${brand.name}, their plan, and account health`}
        actions={<Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New tenant</Button>}
      />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tenants" value={stats.tenants} icon={Building2} tint="brand" />
        <StatCard label="Active subscriptions" value={stats.active} icon={CircleCheck} tint="brand" />
        <StatCard label="Employees (all tenants)" value={stats.employees} icon={Users} tint="amber" />
        <StatCard label="Users (all tenants)" value={stats.users} icon={UserCheck} tint="amber" />
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No tenants yet"
          description="Companies appear here once they sign up, or once you create one."
          action={<Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New tenant</Button>}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle>All tenants</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Employees</th>
                  <th>Users</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/platform/${t.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">{t.name}</Link>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{t.subdomain}</p>
                    </td>
                    <td className="capitalize">{t.plan ?? '—'}</td>
                    <td>
                      <Badge variant={STATUS_VARIANT[t.subscriptionStatus] ?? 'neutral'}>{t.subscriptionStatus}</Badge>
                    </td>
                    <td className="tabular-nums">{t.employeeCount}</td>
                    <td className="tabular-nums">{t.userCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {showNew && <NewTenantModal plans={plans} onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}
