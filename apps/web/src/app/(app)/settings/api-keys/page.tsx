'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { KeyRound, Plus, Copy, Check, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.apiKeys.list()
      .then((data) => setKeys(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load API keys'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    try {
      const key = await api.apiKeys.create(name);
      setCreated(key);
      setName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(created.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        backHref="/settings"
        backLabel="Settings"
        description="Authenticate external apps against the MatrixHR REST API"
        actions={
          <Button onClick={() => { setCreated(null); setModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Generate Key
          </Button>
        }
      />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : keys.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={KeyRound}
                title="No API keys"
                description="Generate a key to integrate external systems via the public REST API."
                action={<Button onClick={() => setModalOpen(true)}><Plus className="mr-2 h-4 w-4" />Generate Key</Button>}
              />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Key</th><th>Created</th><th>Last Used</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.name}</td>
                    <td><code className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">mhr_{k.prefix}_••••••••</code></td>
                    <td className="tabular-nums">{formatDate(k.createdAt)}</td>
                    <td className="tabular-nums">{k.lastUsed ? formatDate(k.lastUsed) : 'Never'}</td>
                    <td>
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onClick={async () => { await api.apiKeys.revoke(k.id); load(); }}>
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={created ? 'Key generated' : 'Generate API key'}
        description={created ? 'Copy it now — it will not be shown again.' : 'Name the key after the system that will use it.'}
      >
        {created ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-brand-300 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950">
              <code className="min-w-0 flex-1 break-all text-xs">{created.key}</code>
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setModalOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Key name</label>
              <Input placeholder="e.g. Zapier integration" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={name.trim().length < 2}>Generate</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
