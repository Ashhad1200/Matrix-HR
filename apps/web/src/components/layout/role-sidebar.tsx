'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, User, Calendar, Clock, DollarSign, Target, GraduationCap, Sparkles,
  Users, Inbox, Briefcase, UserPlus, MessageCircle, BarChart3, Settings, Store, Sliders,
  GitBranch, Shield, Kanban, FileSignature, Heart, Puzzle, Timer, MessagesSquare,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { NavItemWithBadge } from '@/context/auth-context';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, User, Calendar, Clock, DollarSign, Target, GraduationCap, Sparkles,
  Users, Inbox, Briefcase, UserPlus, MessageCircle, BarChart3, Settings, Store, Sliders,
  GitBranch, Shield, Kanban, FileSignature, Heart, Puzzle, Timer, MessagesSquare,
};

const PORTAL_LABELS: Record<string, string> = {
  admin: 'Admin Portal',
  manager: 'Manager Portal',
  ess: 'Employee Portal',
};

const GROUPS: { label: string | null; hrefs: string[] }[] = [
  { label: null, hrefs: ['/dashboard'] },
  { label: 'Workspace', hrefs: ['/my-profile', '/team', '/approvals', '/one-on-ones'] },
  { label: 'People', hrefs: ['/employees', '/recruitment', '/recruitment/kanban', '/recruitment/preboarding', '/onboarding'] },
  { label: 'Time', hrefs: ['/leave', '/attendance', '/timesheets'] },
  { label: 'Pay', hrefs: ['/payroll', '/my-pay'] },
  { label: 'Talent', hrefs: ['/performance', '/performance/enps', '/lms'] },
  { label: 'Insights', hrefs: ['/reports', '/ai'] },
  { label: 'Company', hrefs: ['/whatsapp', '/settings', '/settings/custom-fields', '/settings/workflows', '/settings/audit', '/marketplace', '/extensions'] },
];

function groupNav(navItems: NavItemWithBadge[]) {
  const byHref = new Map(navItems.map((n) => [n.href, n]));
  const used = new Set<string>();
  const groups: { label: string | null; items: NavItemWithBadge[] }[] = [];

  for (const g of GROUPS) {
    const items = g.hrefs.map((h) => byHref.get(h)).filter(Boolean) as NavItemWithBadge[];
    items.forEach((i) => used.add(i.href));
    if (items.length) groups.push({ label: g.label, items });
  }
  const rest = navItems.filter((n) => !used.has(n.href));
  if (rest.length) groups.push({ label: 'More', items: rest });
  return groups;
}

export function RoleSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const navItems: NavItemWithBadge[] = user?.permissions.nav ?? [];

  // Only the longest matching href is active, so /settings/audit doesn't also light up /settings
  const activeHref = navItems
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const groups = groupNav(navItems);
  const displayName = user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email ?? '';

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[hsl(var(--border))] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-sm font-bold text-white shadow-glow">
          M
        </div>
        <div className="min-w-0">
          <span className="block font-display text-base font-bold leading-tight tracking-tight">MatrixHR</span>
          {user && (
            <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {PORTAL_LABELS[user.permissions.portal] ?? user.permissions.portal}
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className={cn(gi > 0 && 'mt-4')}>
            {group.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
                const active = item.href === activeHref;
                const badgeCount = item.badgeCount;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all',
                        active
                          ? 'bg-brand-600 text-white shadow-soft'
                          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0 transition-transform', !active && 'group-hover:scale-110')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeCount != null && badgeCount > 0 && (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                            active ? 'bg-white/25 text-white' : 'bg-brand-600 text-white',
                          )}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user && (
        <div className="shrink-0 border-t border-[hsl(var(--border))] p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
              {displayName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{displayName}</p>
              <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{user.tenant?.name}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md px-1.5 py-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              Out
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
