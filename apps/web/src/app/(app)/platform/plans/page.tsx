'use client';

import { useEffect, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';

const emptyForm = { code: '', name: '', pricePkrMonthly: '', includedEmployees: '', perEmployeePricePkr: '' };

function NewPlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.platform.createPlan({
        code: form.code,
        name: form.name,
        pricePkrMonthly: form.pricePkrMonthly ? Number(form.pricePkrMonthly) : undefined,
        includedEmployees: form.includedEmployees ? Number(form.includedEmployees) : undefined,
        perEmployeePricePkr: form.perEmployeePricePkr ? Number(form.perEmployeePricePkr) : undefined,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New plan" description="Entitlements can be granted per tenant afterward as overrides">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="np-code" className="mb-1.5 block text-sm font-medium">Plan code</label>
          <Input id="np-code" required placeholder="e.g. growth" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="np-name" className="mb-1.5 block text-sm font-medium">Display name</label>
          <Input id="np-name" required placeholder="e.g. Growth" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="np-price" className="mb-1.5 block text-sm font-medium">PKR / month</label>
            <Input id="np-price" type="number" min="0" step="0.01" value={form.pricePkrMonthly} onChange={(e) => setForm((f) => ({ ...f, pricePkrMonthly: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="np-included" className="mb-1.5 block text-sm font-medium">Included seats</label>
            <Input id="np-included" type="number" min="0" value={form.includedEmployees} onChange={(e) => setForm((f) => ({ ...f, includedEmployees: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="np-perseat" className="mb-1.5 block text-sm font-medium">Per extra seat</label>
            <Input id="np-perseat" type="number" min="0" step="0.01" value={form.perEmployeePricePkr} onChange={(e) => setForm((f) => ({ ...f, perEmployeePricePkr: e.target.value }))} />
          </div>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create plan'}</Button>
      </form>
    </Modal>
  );
}

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  function load() {
    return api.platform.plans()
      .then(setPlans)
      .catch((err) => setError(err.message || 'Failed to load plans'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Pricing tiers tenants can subscribe to"
        actions={<Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New plan</Button>}
      />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      {plans.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No plans yet"
          description="Create a plan so tenants have something to subscribe to."
          action={<Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New plan</Button>}
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const v = p.versions?.[0];
            return (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.code}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="font-display text-2xl font-bold tracking-tight">
                    {v?.pricePkrMonthly != null ? formatCurrency(Number(v.pricePkrMonthly)) : '—'}
                    <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]"> /mo</span>
                  </p>
                  <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                    <span>Included seats</span>
                    <span className="tabular-nums text-[hsl(var(--foreground))]">{v?.includedEmployees ?? 0}</span>
                  </div>
                  {v?.perEmployeePricePkr != null && (
                    <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                      <span>Per extra seat</span>
                      <span className="tabular-nums text-[hsl(var(--foreground))]">{formatCurrency(Number(v.perEmployeePricePkr))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                    <span>Entitlements</span>
                    <span className="tabular-nums text-[hsl(var(--foreground))]">{v?.entitlements?.length ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showNew && <NewPlanModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}
