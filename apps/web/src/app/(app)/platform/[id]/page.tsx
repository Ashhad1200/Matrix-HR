'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

const STATUSES = ['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired'];

export default function PlatformTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ featureKey: '', reason: '', enabled: true });

  function load() {
    Promise.all([api.platform.tenant(id), api.platform.plans()])
      .then(([t, p]) => { setTenant(t); setPlans(p); })
      .catch((err) => setError(err.message || 'Failed to load tenant'));
  }

  useEffect(() => { load(); }, [id]);

  async function handleAssignPlan(planCode: string) {
    setBusy(true);
    setError('');
    try {
      await api.platform.assignPlan(id, planCode);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetStatus(status: string) {
    setBusy(true);
    setError('');
    try {
      await api.platform.setStatus(id, status);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteOverride(overrideId: string) {
    setBusy(true);
    setError('');
    try {
      await api.platform.deleteOverride(id, overrideId);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOverride(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.platform.createOverride(id, overrideForm);
      setOverrideForm({ featureKey: '', reason: '', enabled: true });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !tenant) return <p className="text-red-600">{error}</p>;
  if (!tenant) return <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>;

  const sub = tenant.subscription;
  const currentPlanCode = sub?.planVersion?.plan?.code;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/platform"><Button variant="secondary">← Back</Button></Link>
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-[hsl(var(--muted-foreground))]">{tenant.subdomain} · {tenant._count?.employees} employees · {tenant._count?.users} users</p>
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Plan</span>
              <span className="font-medium capitalize">{currentPlanCode ?? 'None'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[hsl(var(--muted-foreground))]">Status</span>
              <Badge variant={statusVariant(sub?.status)}>{sub?.status ?? 'unsubscribed'}</Badge>
            </div>
            {sub?.startedAt && (
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Started</span><span>{formatDate(sub.startedAt)}</span></div>
            )}

            <div className="border-t border-[hsl(var(--border))] pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Change Plan</p>
              <div className="flex flex-wrap gap-2">
                {plans.map((p) => (
                  <Button
                    key={p.code}
                    size="sm"
                    variant={p.code === currentPlanCode ? 'primary' : 'secondary'}
                    disabled={busy || p.code === currentPlanCode}
                    onClick={() => handleAssignPlan(p.code)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Set Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <Button key={s} size="sm" variant="secondary" disabled={busy || s === sub?.status} onClick={() => handleSetStatus(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resolved Entitlements ({Object.keys(tenant.resolvedEntitlements?.features ?? {}).length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {Object.entries(tenant.resolvedEntitlements?.features ?? {}).map(([key, val]: [string, any]) => (
                <div key={key} className="flex justify-between border-b border-[hsl(var(--border))] py-1">
                  <span className="font-mono text-xs">{key}</span>
                  <span>{val.enabled ? '✓' : '—'}{val.limit != null ? ` (limit ${val.limit})` : ''}</span>
                </div>
              ))}
              {!Object.keys(tenant.resolvedEntitlements?.features ?? {}).length && (
                <p className="text-[hsl(var(--muted-foreground))]">No entitlements resolved — assign a plan.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Entitlement Overrides ({sub?.overrides?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-2">Feature</th>
                  <th className="p-2">Enabled</th>
                  <th className="p-2">Reason</th>
                  <th className="p-2">Created</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(sub?.overrides ?? []).map((o: any) => (
                  <tr key={o.id} className="border-b">
                    <td className="p-2 font-mono text-xs">{o.featureKey}</td>
                    <td className="p-2">{o.enabled ? '✓' : '✗'}</td>
                    <td className="p-2">{o.reason}</td>
                    <td className="p-2 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(o.createdAt)}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteOverride(o.id)}
                        className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!sub?.overrides?.length && (
                  <tr><td colSpan={5} className="p-2 text-[hsl(var(--muted-foreground))]">No overrides</td></tr>
                )}
              </tbody>
            </table>

            {sub && (
              <form onSubmit={handleCreateOverride} className="flex flex-wrap items-end gap-2 border-t border-[hsl(var(--border))] pt-4">
                <div>
                  <label className="mb-1 block text-xs font-medium">Feature key</label>
                  <Input
                    placeholder="e.g. sso.saml"
                    value={overrideForm.featureKey}
                    onChange={(e) => setOverrideForm({ ...overrideForm, featureKey: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Grant / Revoke</label>
                  <select
                    className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                    value={overrideForm.enabled ? 'grant' : 'revoke'}
                    onChange={(e) => setOverrideForm({ ...overrideForm, enabled: e.target.value === 'grant' })}
                  >
                    <option value="grant">Grant</option>
                    <option value="revoke">Revoke</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium">Reason</label>
                  <Input
                    placeholder="Why is this override needed?"
                    value={overrideForm.reason}
                    onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" disabled={busy}>Add Override</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
