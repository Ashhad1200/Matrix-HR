'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trialing: 'neutral',
  past_due: 'warning',
  suspended: 'danger',
  cancelled: 'danger',
  expired: 'danger',
  unsubscribed: 'neutral',
};

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.platform.tenants()
      .then(setTenants)
      .catch((err) => setError(err.message || 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform" description="Tenants, plans, and subscriptions across MatrixHR" />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
      {loading ? (
        <p className="text-[hsl(var(--muted-foreground))]">Loading tenants...</p>
      ) : (
        <Card>
          <CardHeader><CardTitle>Tenants ({tenants.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="p-3">Tenant</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Employees</th>
                  <th className="p-3">Users</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-[hsl(var(--muted))]">
                    <td className="p-3">
                      <Link href={`/platform/${t.id}`} className="font-medium text-brand-600 hover:underline">{t.name}</Link>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{t.subdomain}</p>
                    </td>
                    <td className="p-3 capitalize">{t.plan ?? '—'}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_VARIANT[t.subscriptionStatus] ?? 'neutral'}>{t.subscriptionStatus}</Badge>
                    </td>
                    <td className="p-3">{t.employeeCount}</td>
                    <td className="p-3">{t.userCount}</td>
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
