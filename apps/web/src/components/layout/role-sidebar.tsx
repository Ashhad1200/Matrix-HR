'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, User, Calendar, Clock, DollarSign, Target, GraduationCap, Sparkles,
  Users, Inbox, Briefcase, UserPlus, MessageCircle, BarChart3, Settings, Store, Sliders,
  GitBranch, Shield, Kanban, FileSignature, Heart, Puzzle, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { NavItemWithBadge } from '@/context/auth-context';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  User,
  Calendar,
  Clock,
  DollarSign,
  Target,
  GraduationCap,
  Sparkles,
  Users,
  Inbox,
  Briefcase,
  UserPlus,
  MessageCircle,
  BarChart3,
  Settings,
  Store,
  Sliders,
  GitBranch,
  Shield,
  Kanban,
  FileSignature,
  Heart,
  Puzzle,
};

const PORTAL_LABELS: Record<string, string> = {
  admin: 'Admin Portal',
  manager: 'Manager Portal',
  ess: 'Employee Portal',
};

export function RoleSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const navItems: NavItemWithBadge[] = user?.permissions.nav ?? [];

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex h-16 items-center gap-2 border-b border-[hsl(var(--border))] px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          M
        </div>
        <div className="min-w-0">
          <span className="block text-lg font-semibold">MatrixHR</span>
          {user && (
            <span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">
              {PORTAL_LABELS[user.permissions.portal] ?? user.permissions.portal}
            </span>
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const badgeCount = item.badgeCount;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-brand-600 text-white'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badgeCount != null && badgeCount > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        active ? 'bg-white/20 text-white' : 'bg-brand-600 text-white',
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
      </nav>
    </aside>
  );
}
