'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Plug, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const BRAND_TILES: Record<string, string> = {
  deel: 'bg-indigo-600',
  remote: 'bg-blue-600',
  'papaya-global': 'bg-emerald-600',
  okta: 'bg-sky-700',
  'azure-ad': 'bg-blue-700',
  slack: 'bg-purple-600',
  'google-workspace': 'bg-red-500',
  zoom: 'bg-sky-500',
  talentlms: 'bg-teal-600',
  absorb: 'bg-orange-600',
  checkr: 'bg-emerald-700',
  'verified-first': 'bg-cyan-700',
  'human-interest': 'bg-violet-600',
  ease: 'bg-pink-600',
  quickbooks: 'bg-green-700',
  tally: 'bg-amber-600',
  indeed: 'bg-blue-800',
  ziprecruiter: 'bg-green-600',
  rozee: 'bg-rose-600',
  'nadra-verisys': 'bg-slate-700',
  zkteco: 'bg-zinc-700',
  careem: 'bg-lime-600',
};

const SYNC_ICON = {
  bidirectional: ArrowLeftRight,
  inbound: ArrowDownToLine,
  outbound: ArrowUpFromLine,
} as const;

export default function MarketplacePage() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.marketplace.integrations()
      .then((data) => setApps(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load marketplace'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const categories = useMemo(() => [...new Set(apps.map((a) => a.category))].sort(), [apps]);
  const filtered = category ? apps.filter((a) => a.category === category) : apps;
  const connectedCount = apps.filter((a) => a.connected).length;

  const act = async (id: string, action: 'connect' | 'disconnect' | 'sync') => {
    setBusy(id);
    setError('');
    try {
      if (action === 'sync') {
        const result = await api.marketplace.sync(id);
        setSyncResult(result);
        setTimeout(() => setSyncResult(null), 6000);
      } else {
        await api.marketplace[action](id);
      }
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description={`Pre-built connectors across the BambooHR integration pillars · ${connectedCount} connected`}
      />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
      {syncResult && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm animate-rise dark:border-brand-800 dark:bg-brand-950">
          <RefreshCw className="h-4 w-4 text-brand-600" />
          <span>
            <strong className="capitalize">{syncResult.app}</strong> synced —{' '}
            {Object.entries(syncResult.records ?? {}).map(([k, v]) => `${v} ${k}`).join(', ') || 'no records'}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
            !category ? 'bg-brand-600 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
              category === c ? 'bg-brand-600 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((app) => {
          const SyncIcon = SYNC_ICON[app.syncDirection as keyof typeof SYNC_ICON] ?? ArrowLeftRight;
          return (
            <Card key={app.id} className="flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lifted">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl font-display text-base font-bold text-white shadow-soft',
                        BRAND_TILES[app.id] ?? 'bg-brand-600',
                      )}
                    >
                      {app.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{app.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{app.pillar}</p>
                    </div>
                  </div>
                  {app.connected ? (
                    <Badge variant="success"><Check className="h-3 w-3" /> Connected</Badge>
                  ) : app.status === 'coming_soon' ? (
                    <Badge variant="neutral">Coming soon</Badge>
                  ) : null}
                </div>

                <p className="flex-1 text-sm text-[hsl(var(--muted-foreground))]">{app.description}</p>

                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <SyncIcon className="h-3.5 w-3.5" />
                  <span className="capitalize">{app.syncDirection}</span>
                  {app.lastSync && <span>· last sync {new Date(app.lastSync).toLocaleTimeString()}</span>}
                </div>

                <div className="flex flex-wrap gap-1">
                  {(app.scopes ?? []).slice(0, 3).map((s: string) => (
                    <code key={s} className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px]">{s}</code>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  {app.connected ? (
                    <>
                      <Button size="sm" className="flex-1" disabled={busy === app.id} onClick={() => act(app.id, 'sync')}>
                        <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', busy === app.id && 'animate-spin')} /> Sync Now
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy === app.id} onClick={() => act(app.id, 'disconnect')}>
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={app.status === 'coming_soon' || busy === app.id}
                      onClick={() => act(app.id, 'connect')}
                    >
                      <Plug className="mr-1.5 h-3.5 w-3.5" /> Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
