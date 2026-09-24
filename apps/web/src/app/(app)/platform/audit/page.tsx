'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';

export default function PlatformAuditPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.platform.audit(200)
      .then(setEntries)
      .catch((err) => setError(err.message || 'Failed to load the audit log'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Plan changes, subscription status and entitlement overrides across every tenant" />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Actions taken from the Tenants page (assigning a plan, changing status, overrides) show up here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-[hsl(var(--muted-foreground))]">{formatDate(e.createdAt)}</td>
                    <td className="font-medium">{e.action}</td>
                    <td className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{e.targetType} · {e.targetId}</td>
                    <td className="max-w-xs truncate font-mono text-xs text-[hsl(var(--muted-foreground))]">
                      {e.detail ? JSON.stringify(e.detail) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
