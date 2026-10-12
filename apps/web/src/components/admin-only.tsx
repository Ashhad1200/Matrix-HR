'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';

/** For screens whose API is company-admin only: other roles get a plain notice instead of a page full of 403s. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== 'COMPANY_ADMIN') {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] p-6">
        <h1 className="text-xl font-bold">Company admins only</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Ask a company admin to manage this setting.</p>
      </div>
    );
  }
  return <>{children}</>;
}
