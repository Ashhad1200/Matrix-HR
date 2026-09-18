'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Check, Plug } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Maturity = 'available' | 'beta' | 'planned';
type RunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';
type Direction = 'INBOUND' | 'OUTBOUND';
type LastRun = { status: RunStatus; direction: Direction; at: string; processed: number; failed: number; message: string | null };
type MarketplaceApp = {
  id: string; name: string; category: string; pillar: string; description: string; scopes: string[];
  syncDirection: 'bidirectional' | 'inbound' | 'outbound'; maturity: Maturity; mode?: 'push' | 'export';
  includedInPlan: boolean; connected: boolean; lastRun: LastRun | null;
};
type LogRow = {
  id: string; startedAt: string; direction: Direction; status: RunStatus;
  recordsProcessed: number; recordsFailed: number; message: string | null;
};

const BRAND_TILES: Record<string, string> = {
  deel: 'bg-indigo-600', remote: 'bg-blue-600', 'papaya-global': 'bg-emerald-600', okta: 'bg-sky-700',
  'azure-ad': 'bg-blue-700', slack: 'bg-purple-600', 'google-workspace': 'bg-red-500', zoom: 'bg-sky-500',
  talentlms: 'bg-teal-600', absorb: 'bg-orange-600', checkr: 'bg-emerald-700', 'verified-first': 'bg-cyan-700',
  'human-interest': 'bg-violet-600', ease: 'bg-pink-600', quickbooks: 'bg-green-700', tally: 'bg-amber-600',
  indeed: 'bg-blue-800', ziprecruiter: 'bg-green-600', rozee: 'bg-rose-600', 'nadra-verisys': 'bg-slate-700',
  zkteco: 'bg-zinc-700', careem: 'bg-lime-600',
};
const SYNC_ICON = { bidirectional: ArrowLeftRight, inbound: ArrowDownToLine, outbound: ArrowUpFromLine } as const;
const maturityVariant = { available: 'success', beta: 'warning', planned: 'neutral' } as const;
const runVariant = { SUCCESS: 'success', PARTIAL: 'warning', FAILED: 'danger' } as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function when(value: string) {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = date.toLocaleString();
  if (!Number.isFinite(seconds)) return absolute;
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [[86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [size, unit] of ranges) {
    if (Math.abs(seconds) >= size) return `${formatter.format(Math.round(seconds / size), unit)} · ${absolute}`;
  }
  return `${formatter.format(seconds, 'second')} · ${absolute}`;
}

export default function MarketplacePage() {
  const [apps, setApps] = useState<MarketplaceApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, LogRow[]>>({});
  const [logError, setLogError] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.marketplace.integrations();
      setApps(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load marketplace'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => Array.from(new Set(apps.map((app) => app.category))).sort(), [apps]);
  const filtered = category ? apps.filter((app) => app.category === category) : apps;
  const connectedCount = apps.filter((app) => app.connected).length;

  async function act(id: string, action: 'connect' | 'disconnect') {
    setBusy(id);
    setError('');
    try {
      await api.marketplace[action](id);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'The integration could not be updated'));
    } finally {
      setBusy(null);
    }
  }

  async function toggleLogs(id: string) {
    if (openLog === id) { setOpenLog(null); return; }
    setOpenLog(id);
    setLogError('');
    setLogsLoading(true);
    try {
      const data = await api.marketplace.logs(id);
      setLogs((current) => ({ ...current, [id]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      setLogError(errorMessage(err, 'Failed to load integration log'));
    } finally {
      setLogsLoading(false);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Marketplace" description={`Pre-built connectors across HR, payroll, identity, and productivity tools · ${connectedCount} connected`} />
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Only ZKTeco Biometric and QuickBooks have real end-to-end integrations today, and both are Beta. Every other connector is planned and cannot yet be connected.
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCategory('')} className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors', !category ? 'bg-brand-600 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>All</button>
        {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors', category === item ? 'bg-brand-600 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>{item}</button>)}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((app) => {
          const SyncIcon = SYNC_ICON[app.syncDirection] ?? ArrowLeftRight;
          const planBlocked = app.maturity === 'beta' && !app.includedInPlan;
          return (
            <Card key={app.id} data-testid="marketplace-card" className="flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lifted">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl font-display text-base font-bold text-white shadow-soft', BRAND_TILES[app.id] ?? 'bg-brand-600')}>{app.name.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <p className="font-semibold leading-tight">{app.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{app.pillar}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge data-testid="marketplace-maturity" variant={maturityVariant[app.maturity]}>{app.maturity}</Badge>
                    {app.connected && <Badge variant="success"><Check className="h-3 w-3" /> Connected</Badge>}
                  </div>
                </div>
                <p className="flex-1 text-sm text-[hsl(var(--muted-foreground))]">{app.description}</p>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]"><SyncIcon className="h-3.5 w-3.5" /><span className="capitalize">{app.syncDirection}</span></div>
                {app.connected && app.mode === 'push' && <p className="text-xs">Devices push data to MatrixHR automatically · <Link className="text-brand-600 hover:underline" href="/settings/devices">Manage devices</Link></p>}
                {app.connected && app.mode === 'export' && <p className="text-xs">Export from a payroll run on the <Link className="text-brand-600 hover:underline" href="/payroll">Payroll page</Link></p>}
                {app.lastRun && (
                  <div className="space-y-1 rounded-lg bg-[hsl(var(--muted))] p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant={runVariant[app.lastRun.status]}>{app.lastRun.status}</Badge><span>{app.lastRun.direction === 'INBOUND' ? 'In ↓' : 'Out ↑'}</span><span className="text-[hsl(var(--muted-foreground))]">{when(app.lastRun.at)}</span></div>
                    <p>{app.lastRun.processed} ok / {app.lastRun.failed} failed</p>
                    {app.lastRun.message && <p className="text-[hsl(var(--muted-foreground))]">{app.lastRun.message}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">{app.scopes.slice(0, 3).map((scope) => <code key={scope} className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px]">{scope}</code>)}</div>
                {app.maturity === 'planned' ? (
                  <p className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-center text-sm font-medium text-[hsl(var(--muted-foreground))]" aria-disabled="true">Planned — not built yet</p>
                ) : planBlocked ? (
                  <Button size="sm" className="w-full" disabled>Not included in your plan</Button>
                ) : app.connected ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="secondary" disabled className="flex-1"><Check className="mr-1.5 h-3.5 w-3.5" /> Connected</Button>
                    <Button size="sm" variant="secondary" disabled={busy === app.id} onClick={() => void act(app.id, 'disconnect')}>Disconnect</Button>
                    <Button size="sm" variant="ghost" className="w-full" disabled={logsLoading && openLog === app.id} onClick={() => void toggleLogs(app.id)}>{openLog === app.id ? 'Hide log' : 'View log'}</Button>
                  </div>
                ) : (
                  <Button size="sm" className="w-full" disabled={busy === app.id} onClick={() => void act(app.id, 'connect')}><Plug className="mr-1.5 h-3.5 w-3.5" /> Connect</Button>
                )}
                {openLog === app.id && (
                  <section data-testid="marketplace-log-panel" className="space-y-2 border-t border-[hsl(var(--border))] pt-3">
                    <h3 className="text-sm font-semibold">Integration log</h3>
                    {logError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">{logError}</p>}
                    {logsLoading ? <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading log…</p> : !(logs[app.id]?.length) ? <p className="text-xs text-[hsl(var(--muted-foreground))]">No activity yet.</p> : (
                      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-xs">
                        <thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-2">Time</th><th className="p-2">Direction</th><th className="p-2">Status</th><th className="p-2">Processed</th><th className="p-2">Failed</th><th className="p-2">Message</th></tr></thead>
                        <tbody>{logs[app.id].map((row) => <tr key={row.id} className="border-b"><td className="p-2">{new Date(row.startedAt).toLocaleString()}</td><td className="p-2">{row.direction}</td><td className="p-2"><Badge variant={runVariant[row.status]}>{row.status}</Badge></td><td className="p-2">{row.recordsProcessed}</td><td className="p-2">{row.recordsFailed}</td><td className="p-2">{row.message || '—'}</td></tr>)}</tbody>
                      </table></div>
                    )}
                  </section>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
