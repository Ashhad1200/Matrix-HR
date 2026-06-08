'use client';

import { RoleSidebar } from './role-sidebar';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';
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
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ess: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const displayName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user.email;

  return (
    <div className="flex h-screen">
      <RoleSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-[hsl(var(--border))] px-6">
          <div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{user.tenant?.name}</p>
            <div className="flex items-center gap-2">
              <p className="font-medium">{displayName}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PORTAL_BADGE[user.permissions.portal] ?? ''}`}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
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
