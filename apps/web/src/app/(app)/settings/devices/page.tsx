'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

type Device = {
  id: string;
  name: string;
  serialNumber: string;
  location: string | null;
  online: boolean;
  isActive: boolean;
  lastSeenAt: string | null;
  lastPushAt: string | null;
};

type SyncLog = {
  id: string;
  startedAt: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  recordsProcessed: number;
  recordsFailed: number;
  message: string | null;
};

const INPUT_CLASS = 'h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const statusVariant = { SUCCESS: 'success', PARTIAL: 'warning', FAILED: 'danger' } as const;

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export default function BiometricDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [hostname, setHostname] = useState('your-api.example.com');
  const [form, setForm] = useState({ serialNumber: '', name: '', location: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [deviceResult, logResult] = await Promise.allSettled([
      api.biometric.devices(),
      api.marketplace.logs('zkteco'),
    ]);
    if (deviceResult.status === 'fulfilled') setDevices(Array.isArray(deviceResult.value) ? deviceResult.value : []);
    else setError(message(deviceResult.reason, 'Failed to load biometric devices'));
    if (logResult.status === 'fulfilled') setLogs(Array.isArray(logResult.value) ? logResult.value.slice(0, 10) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setHostname(window.location.hostname);
    void load();
  }, [load]);

  async function createDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('create');
    setError('');
    try {
      await api.biometric.createDevice({
        serialNumber: form.serialNumber.trim(),
        name: form.name.trim(),
        location: form.location.trim() || undefined,
      });
      setForm({ serialNumber: '', name: '', location: '' });
      await load();
    } catch (err) {
      setError(message(err, 'Failed to register device'));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(device: Device) {
    setBusy(device.id);
    setError('');
    try {
      await api.biometric.updateDevice(device.id, { isActive: !device.isActive });
      await load();
    } catch (err) {
      setError(message(err, 'Failed to update device'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(device: Device) {
    if (!window.confirm(`Remove ${device.name}? The terminal will no longer be accepted.`)) return;
    setBusy(device.id);
    setError('');
    try {
      await api.biometric.removeDevice(device.id);
      await load();
    } catch (err) {
      setError(message(err, 'Failed to remove device'));
    } finally {
      setBusy(null);
    }
  }

  const marketplaceError = /marketplace|connect|plan|included/i.test(error);

  return (
    <div className="space-y-6">
      <PageHeader title="Biometric devices" description="Register and monitor ZKTeco attendance terminals" />

      <Card>
        <CardHeader><CardTitle>ZKTeco ADMS / Cloud Server setup <Badge variant="warning" className="ml-2">Beta</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Point each terminal at this server using its ADMS or “Cloud Server” settings. This integration is Beta and has not yet been verified against physical hardware in every ZKTeco model.</p>
          <dl className="grid gap-2 rounded-lg bg-[hsl(var(--muted))] p-4 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium">Server Address</dt><dd className="font-mono break-all">{hostname}</dd>
            <dt className="font-medium">Port</dt><dd className="font-mono">3001 in development</dd>
            <dt className="font-medium">Device push path</dt><dd className="font-mono">/iclock/cdata</dd>
          </dl>
          <p className="text-[hsl(var(--muted-foreground))]">Use your API’s public hostname in production, which may differ from the web hostname shown above. Each employee’s PIN on the terminal must equal their Employee Code, or the “Biometric PIN” field on their profile once set.</p>
        </CardContent>
      </Card>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}{marketplaceError && <> · <Link className="font-medium underline" href="/marketplace">Open Marketplace</Link></>}</p>}

      <Card>
        <CardHeader><CardTitle>Register a device</CardTitle></CardHeader>
        <CardContent>
          <form data-testid="device-form" onSubmit={createDevice} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <label className="space-y-1 text-sm font-medium">Serial number<input className={INPUT_CLASS} required value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium">Name<input className={INPUT_CLASS} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium">Location (optional)<input className={INPUT_CLASS} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
            <Button type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Registering…' : 'Register device'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registered devices</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading devices…</p> : !devices.length ? <p className="text-sm text-[hsl(var(--muted-foreground))]">No devices registered.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm">
              <thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Name</th><th className="p-3">Serial</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3">Last seen</th><th className="p-3">Last push</th><th className="p-3">Actions</th></tr></thead>
              <tbody>{devices.map((device) => (
                <tr key={device.id} data-testid="device-row" className="border-b">
                  <td className="p-3 font-medium">{device.name}</td><td className="p-3 font-mono">{device.serialNumber}</td><td className="p-3">{device.location || '—'}</td>
                  <td className="p-3"><Badge variant={device.online ? 'success' : 'neutral'}>{device.online ? 'Online' : 'Offline'}</Badge>{!device.isActive && <Badge variant="neutral" className="ml-1">Inactive</Badge>}</td>
                  <td className="p-3">{dateTime(device.lastSeenAt)}</td><td className="p-3">{dateTime(device.lastPushAt)}</td>
                  <td className="p-3"><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={busy === device.id} onClick={() => void toggle(device)}>{device.isActive ? 'Disable' : 'Enable'}</Button><Button size="sm" variant="danger" disabled={busy === device.id} onClick={() => void remove(device)}>Remove</Button></div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent sync activity</CardTitle></CardHeader>
        <CardContent>
          {!logs.length ? <p className="text-sm text-[hsl(var(--muted-foreground))]">No pushes recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b text-left text-[hsl(var(--muted-foreground))]"><th className="p-3">Time</th><th className="p-3">Status</th><th className="p-3">Processed</th><th className="p-3">Failed</th><th className="p-3">Message</th></tr></thead>
            <tbody>{logs.map((log) => <tr key={log.id} className="border-b"><td className="p-3">{new Date(log.startedAt).toLocaleString()}</td><td className="p-3"><Badge variant={statusVariant[log.status]}>{log.status}</Badge></td><td className="p-3">{log.recordsProcessed}</td><td className="p-3">{log.recordsFailed}</td><td className="p-3">{log.message || '—'}</td></tr>)}</tbody>
          </table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
