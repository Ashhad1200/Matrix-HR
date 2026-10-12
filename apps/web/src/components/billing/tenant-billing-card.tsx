'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';

/**
 * Operator controls for one tenant's billing clock and AI credits. A tenant with no period end can never lapse, get a banner or
 * reminder emails, which is how every pre-existing customer starts. Setting a date here is the deliberate act that puts them on
 * manual renewal.
 */
export function TenantBillingCard({ tenantId }: { tenantId: string }) {
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodReason, setPeriodReason] = useState('');
  const [credits, setCredits] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID()); // a double click sends the same key, so it grants once
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.platformBilling.tenant(tenantId).then(setInfo).catch((e) => setError(e.message)), [tenantId]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<any>, msg: string) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(msg); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const st = info?.state;
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle>Billing clock and AI credits</CardTitle></CardHeader>
      <CardContent className="space-y-5 text-sm">
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        {notice && <p role="status" className="text-emerald-700 dark:text-emerald-300">{notice}</p>}
        {st && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <p>State <Badge variant={st.blocked ? 'danger' : st.state === 'none' ? 'neutral' : 'success'}>{st.state === 'none' ? 'No billing clock' : st.state.replace('_', ' ')}</Badge></p>
            <p>Paid until <strong>{st.periodEnd ? formatDate(st.periodEnd) : 'not set'}</strong></p>
            <p>AI credits <strong className="tabular-nums">{info.credits.credits}</strong></p>
          </div>
        )}
        {st?.state === 'none' && <p className="text-[hsl(var(--muted-foreground))]">This tenant has no period end, so it will never lapse, show a banner or get reminder emails. Set a date to put it on manual renewal.</p>}

        <form className="grid gap-3 sm:grid-cols-[10rem_1fr_auto_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => api.platformBilling.setPeriod(tenantId, { periodEnd: new Date(periodEnd).toISOString(), reason: periodReason }), 'Period end saved.'); }}>
          <div><label htmlFor="tb-end" className="mb-1.5 block font-medium">Paid until</label><Input id="tb-end" type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
          <div><label htmlFor="tb-why" className="mb-1.5 block font-medium">Reason (audited)</label><Input id="tb-why" required minLength={5} value={periodReason} onChange={(e) => setPeriodReason(e.target.value)} placeholder="For example: moved to manual renewal, paid to 31 Dec" /></div>
          <Button type="submit" disabled={busy}>Set period end</Button>
          {st?.periodEnd && <Button type="button" variant="secondary" disabled={busy || periodReason.trim().length < 5} onClick={() => run(() => api.platformBilling.setPeriod(tenantId, { periodEnd: null, reason: periodReason }), 'Billing clock removed.')}>Remove clock</Button>}
        </form>

        <form className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.platformBilling.grantCredits(tenantId, { credits: Number(credits), reason: creditReason, idempotencyKey: key }); setKey(crypto.randomUUID()); setCredits(''); setCreditReason(''); }, 'Credits granted.'); }}>
          <div><label htmlFor="tb-cr" className="mb-1.5 block font-medium">Grant AI credits</label><Input id="tb-cr" inputMode="numeric" required value={credits} onChange={(e) => setCredits(e.target.value)} /></div>
          <div><label htmlFor="tb-crwhy" className="mb-1.5 block font-medium">Reason (audited)</label><Input id="tb-crwhy" required minLength={5} value={creditReason} onChange={(e) => setCreditReason(e.target.value)} /></div>
          <Button type="submit" disabled={busy}>Grant</Button>
        </form>
      </CardContent>
    </Card>
  );
}
