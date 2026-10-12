'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Search, ShieldAlert, X } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { RoleSidebar } from './role-sidebar';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';
import { CommandPalette } from './command-palette';
import { AuthProvider } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import { BillingBanner } from '@/components/billing/billing-banner';
import { BillingPanel } from '@/components/billing/billing-panel';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  HR_MANAGER: 'HR Manager',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

function isRouteAllowed(pathname: string, navHrefs: string[]) {
  return navHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

function LapsedScreen({ canPay, onChanged }: { canPay: boolean; onChanged: () => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Your subscription has ended</h1>
        <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
          {canPay
            ? 'Your data is safe and nothing has been deleted. Pay by bank transfer and upload the proof: you get temporary access while we check it, and full access the moment it is approved.'
            : 'Your company\'s subscription has ended, so MatrixHR is paused for everyone. Your data is safe. Please ask a company admin or HR manager to renew it from the Billing page.'}
        </p>
      </div>
      {canPay && <BillingPanel onChanged={onChanged} />}
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // A lapsed company only gets the billing screen. The API enforces this too; this is the friendly version of that 403.
  const blocked = !!user?.billing?.blocked;
  const navHrefs = user?.permissions.nav.map((n) => n.href) ?? [];
  const allowed = !user || isRouteAllowed(pathname, navHrefs);

  useEffect(() => {
    // Fall back to the first thing this role can actually see, not a hardcoded '/dashboard' — a
    // portal (e.g. backoffice) that has no '/dashboard' in its nav would otherwise redirect-loop.
    if (user && !allowed) {
      router.replace(navHrefs[0] ?? '/dashboard');
    }
  }, [user, allowed, navHrefs, router]);

  if (loading || !user) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4" role="status" aria-label="Loading">
        <LogoMark className="h-12 w-12" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
          <div className="skeleton h-full w-full" />
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          You don&apos;t have access to this page. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh">
      <a href="#main" className="skip-link">Skip to content</a>
      <RoleSidebar className="hidden lg:flex" />

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[hsl(var(--shadow-tint))]/60 backdrop-blur-sm animate-fade-in" onClick={() => setMenuOpen(false)} />
          <RoleSidebar className="relative z-10 max-w-[85vw] shadow-lifted animate-fade-in" onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="-ml-1 cursor-pointer rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
            <p className="truncate text-sm font-semibold">
              {user.permissions.portal === 'platform' ? 'MatrixHR Backoffice' : user.tenant?.name}
            </p>
            <span className="hidden rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))] sm:inline">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden cursor-pointer items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:border-brand-400/70 hover:text-[hsl(var(--foreground))] sm:flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Search</span>
              <kbd className="ml-6 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 font-sans text-[10px] font-semibold">
                Ctrl K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="cursor-pointer rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] sm:hidden"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <BillingBanner />
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{blocked ? <LapsedScreen canPay={['COMPANY_ADMIN', 'HR_MANAGER'].includes(user.role)} onChanged={refresh} /> : children}</div>
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
