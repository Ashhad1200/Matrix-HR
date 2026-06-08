'use client';

import type { PermissionActions } from '@matrixhr/shared';
import { useAuth } from '@/hooks/use-auth';

type PermissionGateProps = {
  action: keyof PermissionActions;
  subAction: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PermissionGate({ action, subAction, children, fallback = null }: PermissionGateProps) {
  const { user } = useAuth();
  if (!user) return null;

  const group = user.permissions.actions[action] as Record<string, boolean> | undefined;
  if (!group?.[subAction]) return <>{fallback}</>;

  return <>{children}</>;
}
