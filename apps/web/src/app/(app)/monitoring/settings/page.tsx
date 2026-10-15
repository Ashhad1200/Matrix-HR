'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { TEXTAREA_CLASS } from '@/components/ui/field';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>{children}{hint && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}</div>;
}
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const fromHHMM = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

const DEFAULT_POLICY = `This company records work activity on company devices to help manage work and time.

What the agent records: active and idle time, counts of mouse and keyboard activity (never which keys), and the name of the app or website in focus.

What it never records: your keystrokes, your screen, your clipboard, or the contents of anything you open.

The agent shows a tray icon while it runs. You can see everything collected about you on your "My Activity" page at any time. Data is kept for a limited time and then deleted.`;

export default function MonitoringSettingsPage() {
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.monitoring.settings();
      setForm({ ...s, policyText: s.policyText || '' });
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const r = await api.monitoring.updateSettings({
        enabled: form.enabled, policyText: form.policyText,
        trackApps: form.trackApps, trackDomains: form.trackDomains,
        workdayStartMin: form.workdayStartMin, workdayEndMin: form.workdayEndMin,
        offlineAlertMins: Number(form.offlineAlertMins), retentionRawDays: Number(form.retentionRawDays), retentionSummaryDays: Number(form.retentionSummaryDays),
      });
      setForm({ ...r, policyText: r.policyText || '' });
      setNotice('Saved.' + (r.enabled ? ' Employees will be asked to accept the policy before the agent pairs.' : ''));
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  if (!form) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring settings" description="Turn monitoring on, publish the policy employees must accept, and set work hours and how long data is kept."
        backHref="/monitoring" backLabel="Activity Monitor" />
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>}

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid="enabled" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Monitoring is on</label>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">When on, each employee sees a request to accept the policy and install the agent on their own My Activity page. The agent records time and activity only.</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.trackApps} onChange={(e) => setForm({ ...form, trackApps: e.target.checked })} /> Record the app in focus</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.trackDomains} onChange={(e) => setForm({ ...form, trackDomains: e.target.checked })} /> Record the website domain in focus</label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="!flex-row items-center justify-between space-y-0">
            <CardTitle>Policy employees must accept</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, policyText: DEFAULT_POLICY })}>Use template</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <label htmlFor="policy" className="sr-only">Policy text</label>
            <textarea id="policy" data-testid="policy" rows={10} className={TEXTAREA_CLASS} value={form.policyText} onChange={(e) => setForm({ ...form, policyText: e.target.value })} placeholder="Explain what is collected and why. Editing this re-asks everyone to accept." />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Current version {form.policyVersion}. Changing the text bumps the version and re-asks everyone to accept.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Work hours &amp; alerts</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field id="wstart" label="Work day start"><Input id="wstart" type="time" value={toHHMM(form.workdayStartMin)} onChange={(e) => setForm({ ...form, workdayStartMin: fromHHMM(e.target.value) })} /></Field>
            <Field id="wend" label="Work day end"><Input id="wend" type="time" value={toHHMM(form.workdayEndMin)} onChange={(e) => setForm({ ...form, workdayEndMin: fromHHMM(e.target.value) })} /></Field>
            <Field id="offmin" label="Alert HR after (minutes offline)" hint="During work hours only"><Input id="offmin" inputMode="numeric" value={form.offlineAlertMins} onChange={(e) => setForm({ ...form, offlineAlertMins: e.target.value })} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Data retention</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="rraw" label="Keep raw activity (days)" hint="Detailed per-window rows, auto-deleted after this"><Input id="rraw" inputMode="numeric" value={form.retentionRawDays} onChange={(e) => setForm({ ...form, retentionRawDays: e.target.value })} /></Field>
            <Field id="rsum" label="Keep daily summaries (days)"><Input id="rsum" inputMode="numeric" value={form.retentionSummaryDays} onChange={(e) => setForm({ ...form, retentionSummaryDays: e.target.value })} /></Field>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit" disabled={busy} data-testid="save-settings">{busy ? 'Saving…' : 'Save settings'}</Button></div>
      </form>
    </div>
  );
}
