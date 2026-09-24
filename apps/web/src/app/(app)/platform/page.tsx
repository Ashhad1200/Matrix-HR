'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Users, UserCheck, CircleCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

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

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.subscriptionStatus === 'active').length;
    return {
      tenants: tenants.length,
      active,
      employees: tenants.reduce((sum, t) => sum + (t.employeeCount ?? 0), 0),
      users: tenants.reduce((sum, t) => sum + (t.userCount ?? 0), 0),
    };
  }, [tenants]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Every company on MatrixHR, their plan, and account health" />

      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tenants" value={stats.tenants} icon={Building2} tint="brand" />
        <StatCard label="Active subscriptions" value={stats.active} icon={CircleCheck} tint="brand" />
        <StatCard label="Employees (all tenants)" value={stats.employees} icon={Users} tint="amber" />
        <StatCard label="Users (all tenants)" value={stats.users} icon={UserCheck} tint="amber" />
      </div>

      {tenants.length === 0 ? (
        <EmptyState icon={Building2} title="No tenants yet" description="Companies appear here once they sign up." />
      ) : (
        <Card>
          <CardHeader><CardTitle>All tenants</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Employees</th>
                  <th>Users</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/platform/${t.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">{t.name}</Link>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{t.subdomain}</p>
                    </td>
                    <td className="capitalize">{t.plan ?? '—'}</td>
                    <td>
                      <Badge variant={STATUS_VARIANT[t.subscriptionStatus] ?? 'neutral'}>{t.subscriptionStatus}</Badge>
                    </td>
                    <td className="tabular-nums">{t.employeeCount}</td>
                    <td className="tabular-nums">{t.userCount}</td>
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
