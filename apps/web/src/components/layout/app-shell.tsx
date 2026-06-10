'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { RoleSidebar } from './role-sidebar';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';
import { CommandPalette } from './command-palette';
import { AuthProvider } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  HR_MANAGER: 'HR Manager',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

const PORTAL_BADGE: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  manager: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  ess: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200',
};

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-lg font-bold text-white shadow-glow">
          M
        </div>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
          <div className="skeleton h-full w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <RoleSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 px-6 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <p className="truncate text-sm font-medium text-[hsl(var(--muted-foreground))]">{user.tenant?.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PORTAL_BADGE[user.permissions.portal] ?? ''}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:border-brand-400 hover:text-[hsl(var(--foreground))] sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="ml-4 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold">
                Ctrl K
              </kbd>
            </button>
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShellInner>{children}</AppShellInner>
    </AuthProvider>
  );
}
