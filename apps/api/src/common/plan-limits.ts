import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Db = Pick<PrismaService, 'subscription' | 'employee' | 'user' | 'userInvite'>;

const planOf = (db: Db, tenantId: string) =>
  db.subscription.findUnique({ where: { tenantId }, select: { planVersion: { select: { maxEmployees: true, maxAdminUsers: true, overagePerEmployee: true } } } });

/**
 * A plan can cap active employees (Starter 25, Growth 100). Plans with an overage price (Business) are never blocked: the extra
 * employees are billed instead. Tenants on legacy plan versions, or with no subscription, have no cap, so existing customers
 * are unaffected.
 */
export async function assertEmployeeRoom(db: Db, tenantId: string) {
  const plan = (await planOf(db, tenantId))?.planVersion;
  if (!plan?.maxEmployees || plan.overagePerEmployee != null) return;
  const active = await db.employee.count({ where: { tenantId, status: 'ACTIVE' } });
  if (active >= plan.maxEmployees) throw new ForbiddenException(`Your plan allows up to ${plan.maxEmployees} active employees. Upgrade from Billing to add more.`);
}

export const ADMIN_ROLES = ['COMPANY_ADMIN', 'HR_MANAGER'] as const;

/** Admin-level logins (company admin, HR manager) are capped per plan; pending invitations count so they cannot be oversubscribed. */
export async function assertAdminSeatRoom(db: Db, tenantId: string) {
  const plan = (await planOf(db, tenantId))?.planVersion;
  if (!plan?.maxAdminUsers) return;
  const [users, invites] = await Promise.all([
    db.user.count({ where: { tenantId, status: 'ACTIVE', role: { in: [...ADMIN_ROLES] } } }),
    db.userInvite.count({ where: { tenantId, role: { in: [...ADMIN_ROLES] }, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  if (users + invites >= plan.maxAdminUsers) throw new ForbiddenException(`Your plan allows up to ${plan.maxAdminUsers} admin users (company admins and HR managers). Upgrade from Billing to add more.`);
}
