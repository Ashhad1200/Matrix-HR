'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, Clock, UserPlus, MessageCircle,
  DollarSign, Briefcase, Target, GraduationCap, BarChart3, Sparkles, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/leave', label: 'Leave', icon: Calendar },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/onboarding', label: 'Onboarding', icon: UserPlus },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/recruitment', label: 'Recruitment', icon: Briefcase },
  { href: '/performance', label: 'Performance', icon: Target },
  { href: '/lms', label: 'Learning', icon: GraduationCap },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/ai', label: 'Ask MatrixHR', icon: Sparkles },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex h-16 items-center gap-2 border-b border-[hsl(var(--border))] px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          M
        </div>
        <span className="text-lg font-semibold">MatrixHR</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
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
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
