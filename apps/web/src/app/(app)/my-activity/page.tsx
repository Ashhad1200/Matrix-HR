'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Laptop, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useAction } from '@/hooks/use-action';
import { formatDate } from '@/lib/utils';

function hm(seconds?: number | null) {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function MyActivityPage() {
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');
  const action = useAction();
  const [installOpen, setInstallOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.monitoring.me();
      setData(d);
      if (d.hasEmployeeProfile) setHistory(await api.monitoring.myActivity());
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function accept() {
    if (await action.run(() => api.monitoring.consent())) load();
  }
  async function pair(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api.monitoring.pairDevice({ name: deviceName.trim() || 'My computer', platform: detectPlatform() });
      setIssuedToken(r.token); setDeviceName(''); load();
    } catch (err: any) { action.run(() => Promise.reject(err)); }
  }
  async function removeDevice(id: string) {
    if (!window.confirm('Remove this agent? It will stop reporting.')) return;
    if (await action.run(() => api.monitoring.removeMyDevice(id))) load();
  }

  if (!data) return <PageSkeleton />;

  if (!data.enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Activity" description="Work-activity monitoring for your company." />
        <EmptyState title="Monitoring is off" description="Your company has not turned on work-activity monitoring. There is nothing to install and nothing being recorded." />
      </div>
    );
  }
  if (!data.hasEmployeeProfile) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Activity" />
        <EmptyState title="No employee profile" description="Your login is not linked to an employee profile, so there is nothing to show here." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Activity" description="You can see everything collected about you. It is time and activity only — never your keystrokes, screen or files."
        actions={data.consented ? <Button onClick={() => { setIssuedToken(null); setInstallOpen(true); }}><Download className="h-4 w-4" aria-hidden="true" /> Install agent</Button> : undefined} />
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {!data.consented ? (
        <Card data-testid="consent-card">
          <CardHeader><CardTitle>Before you install the monitoring agent</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Please read your company&rsquo;s monitoring policy. The agent you install shows a tray icon while it runs, records only time and activity (active/idle time, mouse and keyboard counts, and the app or website in focus), and never records what you type, your screen or your files. You can open this page any time to see your own data.</p>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4 text-sm" data-testid="policy-text">{data.policyText || 'Your company has not written a policy yet.'}</div>
            <div className="flex items-center gap-3">
              <Button onClick={accept} data-testid="accept-consent"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> I understand and accept</Button>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Policy version {data.policyVersion}</span>
            </div>
            {action.error && <p role="alert" className="text-sm text-rose-700">{action.error}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="!flex-row items-center justify-between space-y-0">
            <CardTitle>Your agents</CardTitle>
            <Badge variant="success">Policy accepted {data.consentedAt ? formatDate(data.consentedAt) : ''}</Badge>
          </CardHeader>
          <CardContent>
            {data.devices.length === 0 ? (
              <EmptyState title="No agent installed yet" description="Install the agent on your work computer so your activity is recorded." />
            ) : (
              <ul className="divide-y divide-[hsl(var(--border))]" data-testid="my-devices">
                {data.devices.map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex items-center gap-2 text-sm"><Laptop className="h-4 w-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
                      <span className="font-medium">{d.name}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{d.platform ?? ''} {d.agentVersion ? `· v${d.agentVersion}` : ''}</span>
                      {d.lastSeenAt ? <Badge variant="neutral">last seen {formatDate(d.lastSeenAt)}</Badge> : <Badge variant="warning">never reported</Badge>}
                    </span>
                    <button type="button" aria-label={`Remove ${d.name}`} onClick={() => removeDevice(d.id)}
                      className="cursor-pointer rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {data.today && (
        <Card>
          <CardHeader><CardTitle>Today</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-[hsl(var(--muted-foreground))]">Active</p><p className="text-xl font-semibold tabular-nums">{hm(data.today.activeSeconds)}</p></div>
            <div><p className="text-xs text-[hsl(var(--muted-foreground))]">Idle</p><p className="text-xl font-semibold tabular-nums">{hm(data.today.idleSeconds)}</p></div>
            <div><p className="text-xs text-[hsl(var(--muted-foreground))]">First activity</p><p className="text-xl font-semibold">{data.today.firstActivityAt ? new Date(data.today.firstActivityAt).toLocaleTimeString() : '—'}</p></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>My recent days</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {history.length === 0 ? <EmptyState title="No activity yet" description="Once your agent reports, your daily activity shows here." /> : (
            <table className="data-table" data-testid="my-history">
              <thead><tr><th>Day</th><th className="text-right">Active</th><th className="text-right">Idle</th><th>First</th><th>Last</th></tr></thead>
              <tbody>{history.map((h) => (
                <tr key={h.id}><td>{h.day}</td><td className="text-right tabular-nums">{hm(h.activeSeconds)}</td><td className="text-right tabular-nums">{hm(h.idleSeconds)}</td>
                  <td>{h.firstActivityAt ? new Date(h.firstActivityAt).toLocaleTimeString() : '—'}</td><td>{h.lastActivityAt ? new Date(h.lastActivityAt).toLocaleTimeString() : '—'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {installOpen && (
        <Modal open onClose={() => setInstallOpen(false)} title="Install the monitoring agent" description="Name this computer, then download and run the agent. It shows a tray icon while it runs.">
          {!issuedToken ? (
            <form onSubmit={pair} className="space-y-3">
              <div><label htmlFor="dev-name" className="mb-1.5 block text-sm font-medium">Computer name</label>
                <Input id="dev-name" required value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="e.g. Office laptop" /></div>
              {action.error && <p role="alert" className="text-sm text-rose-700">{action.error}</p>}
              <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setInstallOpen(false)}>Cancel</Button><Button type="submit" data-testid="pair-device">Create pairing</Button></div>
            </form>
          ) : (
            <div className="space-y-3" data-testid="pairing-result">
              <p className="text-sm">Your agent is registered. Download the installer, run it, and paste this one-time pairing key when it asks. We only store a hashed copy — keep it safe.</p>
              <code className="block break-all rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs" data-testid="pairing-token">{issuedToken}</code>
              <div className="flex justify-end gap-2">
                <a href="/api/agent/download" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--muted))]"><Download className="h-4 w-4" aria-hidden="true" /> Download installer</a>
                <Button onClick={() => setInstallOpen(false)}>Done</Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function detectPlatform(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const p = navigator.platform?.toLowerCase() || '';
  if (p.includes('win')) return 'windows';
  if (p.includes('mac')) return 'mac';
  if (p.includes('linux')) return 'linux';
  return undefined;
}
