'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Clock, UserPlus } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="animate-pulse">Loading dashboard...</div>;

  const stats = [
    { label: 'Headcount', value: data.headcount ?? data.teamSize ?? '—', icon: Users },
    { label: 'Pending Leave', value: data.pendingLeave ?? data.pendingApprovals ?? data.pendingLeaveRequests ?? '—', icon: Calendar },
    { label: 'Present Today', value: data.presentToday ?? '—', icon: Clock },
    { label: 'Onboarding', value: data.onboarding ?? '—', icon: UserPlus },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Overview of your organization</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-brand-600/10 p-3">
                  <Icon className="h-5 w-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.nextHoliday && (
        <Card>
          <CardHeader>
            <CardTitle>Next Holiday</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{data.nextHoliday.name}</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{formatDate(data.nextHoliday.date)}</p>
          </CardContent>
        </Card>
      )}

      {data.balances && (
        <Card>
          <CardHeader><CardTitle>Leave Balances</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.balances.map((b: any) => (
                <div key={b.id} className="rounded-lg border border-[hsl(var(--border))] p-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{b.policy.name}</p>
                  <p className="text-xl font-bold">
                    {Number(b.entitled) - Number(b.used) - Number(b.pending)} days
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
