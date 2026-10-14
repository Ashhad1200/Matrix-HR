'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

function hm(seconds?: number | null) {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function MonitoringPage() {
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, a] = await Promise.all([api.monitoring.overview(), api.monitoring.alerts(false)]);
      setData(o); setAlerts(a);
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function resolve(id: string) {
    try { await api.monitoring.resolveAlert(id); load(); } catch (e: any) { setError(e.message); }
  }

  if (!data) return <PageSkeleton />;

  if (!data.enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Activity Monitor" description="Disclosed work-activity monitoring."
          actions={<Link href="/monitoring/settings" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--muted))]"><SettingsIcon className="h-4 w-4" aria-hidden="true" /> Settings</Link>} />
        <EmptyState title="Monitoring is off" description="Turn it on in Settings, publish a policy, and employees will be asked to accept it and install the agent from their own My Activity page." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Monitor" description="Today's team activity and agent status. You see summaries, not keystrokes or screens; every view here is recorded in the audit log."
        actions={<Link href="/monitoring/settings" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--muted))]"><SettingsIcon className="h-4 w-4" aria-hidden="true" /> Settings</Link>} />
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {alerts.length > 0 && (
        <Card data-testid="alerts-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" /> Agent alerts ({alerts.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-[hsl(var(--border))]">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm"><span className="font-medium">{a.employee.firstName} {a.employee.lastName}</span>
                    <Badge className="ml-2" variant="warning">{a.type.replace('AGENT_', '').toLowerCase()}</Badge>
                    <span className="block text-xs text-[hsl(var(--muted-foreground))]">{a.detail} · {formatDate(a.createdAt)}</span></span>
                  <Button size="sm" variant="secondary" onClick={() => resolve(a.id)}>Resolve</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Agents</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {data.devices.length === 0 ? <EmptyState title="No agents yet" description="No one has installed the agent. They do it from their own My Activity page after accepting the policy." /> : (
            <table className="data-table" data-testid="devices-table">
              <thead><tr><th>Employee</th><th>Computer</th><th>Status</th><th>Last seen</th></tr></thead>
              <tbody>{data.devices.map((d: any) => (
                <tr key={d.id}><td className="font-medium">{d.employeeName}</td><td>{d.name} <span className="text-xs text-[hsl(var(--muted-foreground))]">{d.platform ?? ''}</span></td>
                  <td>{d.online ? <Badge variant="success">online</Badge> : <Badge variant="danger">offline</Badge>}</td>
                  <td className="text-sm text-[hsl(var(--muted-foreground))]">{d.lastSeenAt ? formatDate(d.lastSeenAt) : 'never'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Today ({data.day})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {data.summaries.length === 0 ? <EmptyState title="Nothing today yet" description="Daily summaries appear once agents report and the rollup runs." /> : (
            <table className="data-table" data-testid="summaries-table">
              <thead><tr><th>Employee</th><th className="text-right">Active</th><th className="text-right">Idle</th><th className="text-right">Offline</th><th>First</th><th>Last</th></tr></thead>
              <tbody>{data.summaries.map((s: any) => (
                <tr key={s.employeeId}><td className="font-medium">{s.name}</td>
                  <td className="text-right tabular-nums">{hm(s.activeSeconds)}</td><td className="text-right tabular-nums">{hm(s.idleSeconds)}</td><td className="text-right tabular-nums">{hm(s.offlineSeconds)}</td>
                  <td>{s.firstActivityAt ? new Date(s.firstActivityAt).toLocaleTimeString() : '—'}</td><td>{s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleTimeString() : '—'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
