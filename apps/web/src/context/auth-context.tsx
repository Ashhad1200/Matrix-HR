'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { NavItem, UserPermissions } from '@matrixhr/shared';

export type AuthBadges = {
  pendingApprovals: number;
  unreadNotifications: number;
};

export type BillingSummary = {
  state: 'none' | 'ok' | 'due_soon' | 'grace' | 'lapsed' | 'provisional';
  blocked: boolean;
  banner: 'lapsed' | 'provisional' | 'pending' | 'rejected' | 'grace' | 'due_soon' | null;
  periodEnd?: string | null;
  graceEndsAt?: string | null;
  daysToEnd?: number | null;
  provisionalUntil?: string | null;
  subscription?: { planName: string; planCode: string; status: string; billingPeriod: string; trialEndsAt?: string | null } | null;
  openRequest?: { id: string; status: string; purpose: string; reference: string } | null;
  rejectedReason?: string | null;
};

export type NavItemWithBadge = NavItem & { badgeCount?: number };

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  employeeId?: string | null;
  tenant: { id: string; name: string; subdomain: string };
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    address?: string | null;
    emergencyContact?: string | null;
    department?: { name: string };
    designation?: { name: string };
  } | null;
  permissions: UserPermissions & { nav: NavItemWithBadge[] };
  badges: AuthBadges;
  twoFaEnabled: boolean;
  /** null for the platform operator. Everyone else learns whether the company is blocked; only admins get banner details. */
  billing?: BillingSummary | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const me = await api.auth.me();
      setUser(me);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) void api.auth.logout({ refreshToken }).catch(() => undefined);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh: loadUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
