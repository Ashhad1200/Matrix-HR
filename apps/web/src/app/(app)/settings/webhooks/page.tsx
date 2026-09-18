'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

const EVENTS = ['employee.created', 'employee.updated', 'employee.terminated', 'leave.approved'] as const;
const INPUT_CLASS = 'h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

type Health = 'healthy' | 'degraded' | 'failing' | 'disabled';
type DeliveryStatus = 'delivered' | 'pending' | 'retrying' | 'failed';
type Webhook = {
  id: string; url: string; events: string[]; isActive: boolean; health: Health; consecutiveFailures: number;
  lastSuccessAt: string | null; lastFailureAt: string | null; lastError: string | null; disabledReason: string | null;
};
type Delivery = {
  id: string; event: string; status: DeliveryStatus; attempts: number; nextAttemptAt: string | null;
  deliveredAt: string | null; lastError: string | null; response: string | null; createdAt: string;
};

const healthVariant = { healthy: 'success', degraded: 'warning', failing: 'danger', disabled: 'neutral' } as const;
const deliveryVariant = { delivered: 'success', pending: 'warning', retrying: 'warning', failed: 'danger' } as const;

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ url: '', events: [] as string[], secret: '' });
  const [oneTimeSecret, setOneTimeSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [testResult, setTestResult] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.webhooks.list();
      setWebhooks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(message(err, 'Failed to load webhooks'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeliveries = useCallback(async (id: string) => {
    setDeliveryError('');
    try {
      const data = await api.webhooks.deliveries(id);
      setDeliveries(Array.isArray(data) ? data : []);
    } catch (err) {
      setDeliveryError(message(err, 'Failed to load deliveries'));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('create');
    setError('');
    setOneTimeSecret('');
    try {
      const created = await api.webhooks.create({ url: form.url.trim(), events: form.events, secret: form.secret.trim() || undefined });
      setOneTimeSecret(created.secret);
      setCopied(false);
      setForm({ url: '', events: [], secret: '' });
      await load();
    } catch (err) {
      setError(message(err, 'Failed to create webhook'));
    } finally {
      setBusy(null);
    }
  }

  function changeEvent(eventName: string, checked: boolean) {
    setForm((current) => ({ ...current, events: checked ? [...current.events, eventName] : current.events.filter((item) => item !== eventName) }));
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(oneTimeSecret);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select and copy the secret manually.');
    }
  }

  async function toggle(hook: Webhook) {
    setBusy(hook.id);
    setError('');
    try {
      await api.webhooks.update(hook.id, { isActive: !hook.isActive });
      await load();
    } catch (err) {
      setError(message(err, 'Failed to update webhook'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(hook: Webhook) {
    if (!window.confirm(`Delete webhook ${hook.url}? Its delivery history will also be removed.`)) return;
    setBusy(hook.id);
    setError('');
    try {
      await api.webhooks.remove(hook.id);
      if (selectedId === hook.id) { setSelectedId(null); setDeliveries([]); }
      await load();
    } catch (err) {
      setError(message(err, 'Failed to delete webhook'));
    } finally {
      setBusy(null);
    }
  }

  async function showDeliveries(id: string) {
    if (selectedId === id) { setSelectedId(null); return; }
    setSelectedId(id);
    setDeliveries([]);
    setTestResult('');
    await loadDeliveries(id);
  }

  async function sendTest(id: string) {
    setBusy(`test-${id}`);
    setError('');
    setTestResult('');
    try {
      const result = await api.webhooks.test(id);
      setSelectedId(id);
      setTestResult(`Test delivery: ${result?.status || 'queued'}`);
      await Promise.all([loadDeliveries(id), load()]);
    } catch (err) {
      setError(message(err, 'Failed to send test delivery'));
    } finally {
      setBusy(null);
    }
  }

  async function redeliver(delivery: Delivery) {
    if (!selectedId) return;
    setBusy(delivery.id);
    setDeliveryError('');
    try {
      const result = await api.webhooks.redeliver(delivery.id);
      setTestResult(`Redelivery: ${result?.status || 'queued'}`);
      await Promise.all([loadDeliveries(selectedId), load()]);
    } catch (err) {
      setDeliveryError(message(err, 'Failed to redeliver'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description="Send signed MatrixHR events to your systems" />
      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <Card>
        <CardHeader><CardTitle>Create webhook</CardTitle></CardHeader>
        <CardContent>
          <form data-testid="webhook-form" onSubmit={createWebhook} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">Endpoint URL<input className={INPUT_CLASS} type="url" placeholder="https://example.com/webhooks/matrixhr" required value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></label>
              <label className="space-y-1 text-sm font-medium">Custom signing secret (optional)<input className={INPUT_CLASS} type="password" autoComplete="new-password" value={form.secret} onChange={(event) => setForm({ ...form, secret: event.target.value })} /></label>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Events</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{EVENTS.map((eventName) => <label key={eventName} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] p-3 text-sm"><input type="checkbox" checked={form.events.includes(eventName)} onChange={(event) => changeEvent(eventName, event.target.checked)} />{eventName}</label>)}</div>
            </fieldset>
            <Button type="submit" disabled={busy === 'create' || form.events.length === 0}>{busy === 'create' ? 'Creating…' : 'Create webhook'}</Button>
          </form>
        </CardContent>
      </Card>

      {oneTimeSecret && (
        <div data-testid="webhook-secret" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Copy this signing secret now — it will not be shown again</p>
          <div className="flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-lg bg-white/70 p-3 text-sm dark:bg-black/20">{oneTimeSecret}</code><Button type="button" variant="secondary" onClick={() => void copySecret()}>{copied ? 'Copied' : 'Copy'}</Button></div>
          <p className="text-sm">Verify the <code>X-Webhook-Signature</code> header as <code>sha256=</code> + HMAC-SHA256(secret, timestamp + &quot;.&quot; + rawBody), using the <code>X-Webhook-Timestamp</code> header value as the timestamp.</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Configured webhooks</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading webhooks…</p> : !webhooks.length ? <p className="text-sm text-[hsl(var(--muted-foreground))]">No webhooks configured.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm">
              <thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">URL</th><th className="p-3">Events</th><th className="p-3">Health</th><th className="p-3">Failures</th><th className="p-3">Last success</th><th className="p-3">Last failure</th><th className="p-3">Actions</th></tr></thead>
              <tbody>{webhooks.map((hook) => (
                <tr key={hook.id} data-testid="webhook-row" className="border-b align-top">
                  <td className="max-w-64 break-all p-3 font-medium">{hook.url}{hook.disabledReason && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{hook.disabledReason}</p>}</td>
                  <td className="p-3"><div className="flex max-w-72 flex-wrap gap-1">{hook.events.map((eventName) => <code key={eventName} className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">{eventName}</code>)}</div></td>
                  <td className="p-3"><Badge data-testid="webhook-health" variant={healthVariant[hook.health]}>{hook.health}</Badge></td>
                  <td className="p-3">{hook.consecutiveFailures}</td><td className="p-3">{dateTime(hook.lastSuccessAt)}</td>
                  <td className="max-w-64 p-3">{dateTime(hook.lastFailureAt)}{hook.lastError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{hook.lastError}</p>}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-2"><Button data-testid="webhook-test" size="sm" disabled={busy === `test-${hook.id}`} onClick={() => void sendTest(hook.id)}>Send test</Button><Button size="sm" variant="secondary" onClick={() => void showDeliveries(hook.id)}>Deliveries</Button><Button size="sm" variant="secondary" disabled={busy === hook.id} onClick={() => void toggle(hook)}>{hook.isActive ? 'Disable' : 'Enable'}</Button><Button size="sm" variant="danger" disabled={busy === hook.id} onClick={() => void remove(hook)}>Delete</Button></div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      {selectedId && (
        <Card>
          <CardHeader><CardTitle>Deliveries</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {testResult && <p className="rounded-lg bg-[hsl(var(--muted))] px-4 py-2 text-sm">{testResult}</p>}
            {deliveryError && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{deliveryError}</p>}
            {!deliveries.length ? <p className="text-sm text-[hsl(var(--muted-foreground))]">No deliveries yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Event</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Next / delivered</th><th className="p-3">Last error / response</th><th className="p-3">Action</th></tr></thead>
              <tbody>{deliveries.map((delivery) => <tr key={delivery.id} data-testid="delivery-row" className="border-b align-top"><td className="p-3 font-medium">{delivery.event}</td><td className="p-3"><Badge variant={deliveryVariant[delivery.status]}>{delivery.status}</Badge></td><td className="p-3">{delivery.attempts}</td><td className="p-3">{delivery.status === 'delivered' ? dateTime(delivery.deliveredAt) : dateTime(delivery.nextAttemptAt)}</td><td className="max-w-md break-words p-3">{delivery.lastError || delivery.response || '—'}</td><td className="p-3">{delivery.status !== 'delivered' && <Button size="sm" variant="secondary" disabled={busy === delivery.id} onClick={() => void redeliver(delivery)}>Redeliver</Button>}</td></tr>)}</tbody>
            </table></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
