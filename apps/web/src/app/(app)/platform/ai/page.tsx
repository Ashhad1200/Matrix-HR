'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', modelKey: 'openaiModel', keyField: 'openaiKey' },
  { id: 'anthropic', label: 'Anthropic', modelKey: 'anthropicModel', keyField: 'anthropicKey' },
  { id: 'gemini', label: 'Google Gemini', modelKey: 'geminiModel', keyField: 'geminiKey' },
] as const;

export default function PlatformAiPage() {
  const [s, setS] = useState<any>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [grant, setGrant] = useState({ tenantId: '', credits: '100', reason: '' });

  const load = useCallback(async () => {
    setS(await api.platformAi.settings());
    api.platformAi.usage().then((u) => setUsage(Array.isArray(u) ? u : u?.rows ?? [])).catch(() => undefined);
  }, []);
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [load]);

  async function save(patch: Record<string, unknown>, label: string) {
    setErr(''); setMsg('');
    try { setS(await api.platformAi.save(patch)); setKeys({}); setMsg(`${label} saved.`); } catch (e: any) { setErr(e.message); }
  }

  async function doGrant(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const r = await api.platformAi.grant(grant.tenantId.trim(), { credits: Number(grant.credits), reason: grant.reason, idempotencyKey: crypto.randomUUID() });
      setMsg(`Granted. New balance: ${r.credits} credits.`); load();
    } catch (e: any) { setErr(e.message); }
  }

  if (!s) return <PageSkeleton />;
  return (
    <div className="space-y-6">
      <PageHeader title="AI assistant" description="The master switch, provider and keys. Keys are write-only: they are encrypted and never shown again." />
      {msg && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>}
      {err && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}

      <Card>
        <CardHeader><CardTitle>Master switch</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm">{s.enabled ? 'The assistant is ON for every company that has it enabled.' : 'The assistant is OFF for everyone. Takes effect on the next request.'}</p>
          <Button data-testid="ai-master" onClick={() => save({ enabled: !s.enabled }, 'Master switch')}>{s.enabled ? 'Turn off' : 'Turn on'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Provider and keys</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {PROVIDERS.map((p) => (
            <fieldset key={p.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="radio" name="provider" checked={s.provider === p.id} onChange={() => save({ provider: p.id }, 'Provider')} /> {p.label}{s.provider === p.id && <span className="rounded bg-[hsl(var(--muted))] px-1.5 text-xs">active</span>}</label>
              <div>
                <label htmlFor={`m-${p.id}`} className="mb-1 block text-xs">Model</label>
                <select id={`m-${p.id}`} value={s.models[p.id]} onChange={(e) => save({ [p.modelKey]: e.target.value }, 'Model')} className="h-10 w-full rounded-md border bg-transparent px-2 text-sm">
                  {s.availableModels.map((m: string) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`k-${p.id}`} className="mb-1 block text-xs">API key {s.keys[p.id] ? '(saved - enter a new one to replace)' : '(not set)'}</label>
                <div className="flex gap-2">
                  <Input id={`k-${p.id}`} type="password" autoComplete="off" placeholder={s.keys[p.id] ? '••••••••••••' : 'paste key'} value={keys[p.id] ?? ''} onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })} />
                  <Button variant="secondary" disabled={!keys[p.id]} onClick={() => save({ [p.keyField]: keys[p.id] }, 'Key')}>Save</Button>
                </div>
              </div>
            </fieldset>
          ))}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Customers are charged the provider's cost x 4 (1 credit = $0.01). A model without a price in the table is refused.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Grant credits</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={doGrant} className="grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end">
            <div><label htmlFor="g-t" className="mb-1 block text-xs">Tenant id</label><Input id="g-t" required value={grant.tenantId} onChange={(e) => setGrant({ ...grant, tenantId: e.target.value })} /></div>
            <div><label htmlFor="g-c" className="mb-1 block text-xs">Credits</label><Input id="g-c" type="number" min={1} required value={grant.credits} onChange={(e) => setGrant({ ...grant, credits: e.target.value })} /></div>
            <div><label htmlFor="g-r" className="mb-1 block text-xs">Reason (audited)</label><Input id="g-r" required minLength={5} value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} /></div>
            <Button type="submit">Grant</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usage by company</CardTitle></CardHeader>
        <CardContent>
          {usage.length === 0 ? <p className="text-sm text-[hsl(var(--muted-foreground))]">No usage yet.</p> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-xs text-[hsl(var(--muted-foreground))]"><th className="py-1">Company</th><th className="text-right">Calls</th><th className="text-right">Credits used</th><th className="text-right">Credits received</th></tr></thead>
              <tbody>{usage.map((u: any) => <tr key={u.tenantId} className="border-t"><td className="py-1.5">{u.name}<span className="block text-xs text-[hsl(var(--muted-foreground))]">{u.tenantId}</span></td><td className="text-right tabular-nums">{u.calls}</td><td className="text-right tabular-nums">{Number(u.creditsUsed).toFixed(2)}</td><td className="text-right tabular-nums">{Number(u.creditsGranted + u.creditsPurchased).toFixed(2)}</td></tr>)}</tbody></table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
