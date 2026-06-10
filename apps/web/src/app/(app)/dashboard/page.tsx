'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Avatar } from '@/components/ui/avatar';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Users, Calendar, Clock, UserPlus, Inbox, Target, Briefcase, Cake, Award,
  Palmtree, ArrowRight, Sun,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatGrid({ portal, data }: { portal: string; data: any }) {
  if (portal === 'ess') {
    const clockedIn = data.todayAttendance?.clockIn && !data.todayAttendance?.clockOut;
    const totalLeft = (data.balances ?? []).reduce(
      (s: number, b: any) => s + (Number(b.entitled) - Number(b.used) - Number(b.pending)),
      0,
    );
    return (
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leave Days Left" value={totalLeft} icon={Palmtree} tint="brand" hint="across all policies" />
        <StatCard label="Time Clock" value={clockedIn ? 'Clocked In' : 'Clocked Out'} icon={Clock} tint={clockedIn ? 'brand' : 'amber'} />
        <StatCard label="Pending Requests" value={data.pendingLeaveRequests ?? 0} icon={Calendar} tint="sky" />
        <StatCard label="Next Holiday" value={data.nextHoliday?.name ?? '—'} icon={Sun} tint="violet" hint={data.nextHoliday ? formatDate(data.nextHoliday.date) : undefined} />
      </div>
    );
  }
  if (portal === 'manager') {
    return (
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Team Size" value={data.teamSize ?? '—'} icon={Users} tint="brand" />
        <StatCard label="Pending Approvals" value={data.pendingApprovals ?? 0} icon={Inbox} tint="amber" hint="waiting on you" />
        <StatCard label="On Leave Today" value={data.teamOnLeave?.length ?? 0} icon={Palmtree} tint="sky" />
        <StatCard label="Next Holiday" value={data.nextHoliday?.name ?? '—'} icon={Sun} tint="violet" hint={data.nextHoliday ? formatDate(data.nextHoliday.date) : undefined} />
      </div>
    );
  }
  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Headcount" value={data.headcount ?? '—'} icon={Users} tint="brand" />
      <StatCard label="Present Today" value={data.presentToday ?? '—'} icon={Clock} tint="sky" />
      <StatCard label="Pending Leave" value={data.pendingLeave ?? '—'} icon={Calendar} tint="amber" />
      <StatCard label="On Leave" value={data.onLeaveToday ?? '—'} icon={Palmtree} tint="violet" />
      <StatCard label="Onboarding" value={data.onboarding ?? '—'} icon={UserPlus} tint="rose" />
      <StatCard label="Open Roles" value={data.openJobs ?? '—'} icon={Briefcase} tint="brand" />
    </div>
  );
}

function WhosOutCard({ whosOut }: { whosOut: any[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Who&apos;s Out Today</CardTitle>
        <Link href="/leave" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
          Calendar <ArrowRight className="inline h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {!whosOut?.length ? (
          <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Everyone&apos;s in — full house today.
          </p>
        ) : (
          <ul className="space-y-3">
            {whosOut.map((r: any) => (
              <li key={r.id} className="flex items-center gap-3">
                <Avatar name={`${r.employee?.firstName} ${r.employee?.lastName}`} src={r.employee?.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.employee?.firstName} {r.employee?.lastName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {r.policy?.name ?? 'Leave'} · until {formatDate(r.endDate)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CelebrationsCard({ celebrations }: { celebrations: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Celebrations</CardTitle>
      </CardHeader>
      <CardContent>
        {!celebrations?.length ? (
          <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No birthdays or anniversaries in the next 30 days.
          </p>
        ) : (
          <ul className="space-y-3">
            {celebrations.map((c: any, i: number) => (
              <li key={i} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  {c.type === 'birthday' ? <Cake className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.employee?.firstName} {c.employee?.lastName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {c.type === 'birthday' ? 'Birthday' : `${c.years} year anniversary`} · {formatDate(c.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DepartmentChart({ distribution }: { distribution: { name: string; count: number }[] }) {
  const max = Math.max(...distribution.map((d) => d.count), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Headcount by Department</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {distribution.map((d) => (
          <div key={d.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="tabular-nums text-[hsl(var(--muted-foreground))]">{d.count}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-700"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function QuickActions({ portal }: { portal: string }) {
  const actions =
    portal === 'admin'
      ? [
          { href: '/employees', label: 'Add Employee', icon: UserPlus },
          { href: '/payroll', label: 'Run Payroll', icon: Target },
          { href: '/recruitment/kanban', label: 'ATS Board', icon: Briefcase },
          { href: '/reports', label: 'Reports', icon: Inbox },
        ]
      : portal === 'manager'
        ? [
            { href: '/approvals', label: 'Approvals', icon: Inbox },
            { href: '/one-on-ones', label: '1-on-1s', icon: Users },
            { href: '/team', label: 'My Team', icon: Users },
            { href: '/timesheets', label: 'Timesheets', icon: Clock },
          ]
        : [
            { href: '/leave', label: 'Request Leave', icon: Calendar },
            { href: '/attendance', label: 'Clock In/Out', icon: Clock },
            { href: '/timesheets', label: 'Log Hours', icon: Target },
            { href: '/my-pay', label: 'Pay Stubs', icon: Inbox },
          ];

  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm font-medium shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lifted"
          >
            <Icon className="h-4 w-4 text-brand-600 transition-transform group-hover:scale-110 dark:text-brand-400" />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load dashboard'));
  }, []);

  if (error) {
    return <EmptyState title="Dashboard unavailable" description={error} />;
  }
  if (!data) return <PageSkeleton />;

  const portal = user?.permissions.portal ?? 'admin';
  const firstName = user?.employee?.firstName ?? user?.email?.split('@')[0] ?? 'there';
  const dateLine = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <p className="text-sm font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">{dateLine}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          {portal === 'ess' ? 'Your personal overview' : portal === 'manager' ? 'Your team at a glance' : `Everything happening across ${user?.tenant?.name ?? 'your organization'}`}
        </p>
      </div>

      <StatGrid portal={portal} data={data} />

      <QuickActions portal={portal} />

      <div className="stagger grid gap-4 lg:grid-cols-3">
        <WhosOutCard whosOut={data.whosOut ?? data.teamOnLeave ?? []} />
        <CelebrationsCard celebrations={data.celebrations ?? []} />

        {portal === 'admin' && data.departmentDistribution?.length > 0 && (
          <DepartmentChart distribution={data.departmentDistribution} />
        )}

        {portal === 'admin' && data.recentHires?.length > 0 && (
          <Card className={data.departmentDistribution?.length ? 'lg:col-span-3' : ''}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Hires</CardTitle>
              <Link href="/employees" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                All employees <ArrowRight className="inline h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {data.recentHires.map((e: any) => (
                  <Link
                    key={e.id}
                    href={`/employees/${e.id}`}
                    className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-3 transition-all hover:border-brand-400 hover:shadow-soft"
                  >
                    <Avatar name={`${e.firstName} ${e.lastName}`} src={e.photoUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.firstName} {e.lastName}</p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {e.designation?.name ?? 'Joined'} · {formatDate(e.dateOfJoining)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {portal === 'manager' && data.teamMembers?.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Team</CardTitle>
              <Link href="/team" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                Console <ArrowRight className="inline h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.teamMembers.slice(0, 6).map((e: any) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <Avatar name={`${e.firstName} ${e.lastName}`} src={e.photoUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.firstName} {e.lastName}</p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{e.designation?.name ?? '—'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {portal === 'ess' && data.balances?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Leave Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.balances.map((b: any) => {
                const left = Number(b.entitled) - Number(b.used) - Number(b.pending);
                const pct = (left / Math.max(Number(b.entitled), 1)) * 100;
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{b.policy.name}</span>
                      <span className="tabular-nums text-[hsl(var(--muted-foreground))]">{left} / {Number(b.entitled)} days</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
