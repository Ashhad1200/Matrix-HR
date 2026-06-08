'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

export default function ApprovalsPage() {
  const { refresh } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.approvals.inbox()
      .then((data) => setItems(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load approvals'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string) {
    await api.approvals.approve(id);
    load();
    await refresh();
  }

  async function handleReject(id: string) {
    await api.approvals.reject(id, 'Not approved at this time');
    load();
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Review and action pending requests</p>
      </div>

      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading inbox...</p>
      ) : error ? (
        <Card><CardContent className="p-6"><p className="text-red-600">{error}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Pending Items ({items.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No pending approvals</p>
            ) : items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-4">
                <div>
                  <p className="font-medium">{item.title ?? item.type}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {item.employee?.firstName} {item.employee?.lastName}
                    {item.description && ` · ${item.description}`}
                  </p>
                  {item.createdAt && (
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Submitted {formatDate(item.createdAt)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(item.id)}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => handleReject(item.id)}>Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
