'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, User, Calendar, Clock, DollarSign, Target, GraduationCap, Sparkles,
  Users, Inbox, Briefcase, UserPlus, MessageCircle, BarChart3, Settings, Store, Sliders,
  GitBranch, Shield, Kanban, FileSignature, Heart, Puzzle, Timer, MessagesSquare, Building2,
  UserMinus, Receipt, Banknote, LogOut, ScrollText, Layers, CreditCard, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import { useAuth } from '@/hooks/use-auth';
import type { NavItemWithBadge } from '@/context/auth-context';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, User, Calendar, Clock, DollarSign, Target, GraduationCap, Sparkles,
  Users, Inbox, Briefcase, UserPlus, MessageCircle, BarChart3, Settings, Store, Sliders,
  GitBranch, Shield, Kanban, FileSignature, Heart, Puzzle, Timer, MessagesSquare, Building2,
  UserMinus, Receipt, Banknote, ScrollText, Layers, CreditCard,
};

const PORTAL_LABELS: Record<string, string> = {
  admin: 'Admin Portal',
  manager: 'Manager Portal',
  ess: 'Employee Portal',
  platform: 'Backoffice',
};

const GROUPS: { label: string | null; hrefs: string[] }[] = [
  { label: null, hrefs: ['/dashboard'] },
  { label: 'Manage', hrefs: ['/platform', '/platform/billing', '/platform/plans', '/platform/audit'] },
  { label: 'Workspace', hrefs: ['/my-profile', '/team', '/approvals', '/one-on-ones'] },
  { label: 'People', hrefs: ['/employees', '/recruitment', '/recruitment/kanban', '/recruitment/preboarding', '/onboarding', '/offboarding'] },
  { label: 'Time', hrefs: ['/leave', '/attendance', '/timesheets'] },
  { label: 'Pay', hrefs: ['/payroll', '/my-pay', '/expenses', '/loans'] },
  { label: 'Talent', hrefs: ['/performance', '/performance/enps', '/lms'] },
  { label: 'Insights', hrefs: ['/reports', '/ai'] },
  { label: 'Company', hrefs: ['/whatsapp', '/settings', '/settings/custom-fields', '/settings/workflows', '/settings/audit', '/billing', '/marketplace', '/extensions'] },
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

export function RoleSidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const navItems: NavItemWithBadge[] = user?.permissions.nav ?? [];

  // Only the longest matching href is active, so /settings/audit doesn't also light up /settings
  const activeHref = navItems
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const groups = groupNav(navItems);
  const isBackoffice = user?.permissions.portal === 'platform';
  const displayName = user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email ?? '';
  const homeHref = navItems[0]?.href ?? '/dashboard';

  return (
    <aside className={cn('flex h-dvh w-64 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]', className)}>
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
        <Link href={homeHref} onClick={onNavigate} className="rounded-md" aria-label="MatrixHR home">
          <Logo markClassName="h-7 w-7" />
        </Link>
        {user && (
          <span className="shrink-0 whitespace-nowrap rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            {PORTAL_LABELS[user.permissions.portal] ?? user.permissions.portal}
          </span>
        )}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className={cn(gi > 0 && 'mt-5')}>
            {group.label && (
              <p className="mb-1.5 px-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">{group.label}</p>
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
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                        active
                          ? 'bg-brand-100/80 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100'
                          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                      )}
                    >
                      {active && (
                        <span aria-hidden="true" className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-400" />
                      )}
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'transition-transform group-hover:scale-110')} aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeCount != null && badgeCount > 0 && (
                        <span className="rounded-md bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white dark:bg-brand-500">
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
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[28%] bg-brand-700 text-xs font-bold text-white dark:bg-brand-600">
              {displayName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{displayName}</p>
              <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                {isBackoffice ? 'Platform operator' : user.tenant?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="cursor-pointer rounded-md p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
