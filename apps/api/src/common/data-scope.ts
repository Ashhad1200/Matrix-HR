import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** Who is asking — taken from the JWT, never from the request body or query. */
export type Viewer = { userId: string; role: string; employeeId?: string | null };

export const viewerOf = (u: { id: string; role: string; employeeId?: string | null }): Viewer => ({
  userId: u.id,
  role: u.role,
  employeeId: u.employeeId,
});

export const isHrPlus = (role: string) => ['HR_MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'].includes(role);

/**
 * Employee ids whose records this viewer may see: `null` means everyone in the tenant (HR and above),
 * a manager sees themself plus direct reports, everyone else only themself.
 */
export async function scopedEmployeeIds(prisma: PrismaService, tenantId: string, v: Viewer): Promise<string[] | null> {
  if (isHrPlus(v.role)) return null;
  const own = v.employeeId ? [v.employeeId] : [];
  if (v.role === 'MANAGER' && v.employeeId) {
    const reports = await prisma.employee.findMany({ where: { tenantId, managerId: v.employeeId }, select: { id: true } });
    return [...own, ...reports.map((r) => r.id)];
  }
  return own;
}

/** Narrows an optional `employeeId` filter to what the viewer may see (never widens it). */
export function employeeIdFilter(allowed: string[] | null, requested?: string) {
  if (allowed === null) return requested ? { employeeId: requested } : {};
  if (requested) return { employeeId: allowed.includes(requested) ? requested : '__none__' };
  return { employeeId: { in: allowed } };
}

const MODELS = {
  employee: 'employee',
  department: 'department',
  designation: 'designation',
  leavePolicy: 'leavePolicy',
  course: 'course',
  jobPosting: 'jobPosting',
  reviewCycle: 'reviewCycle',
  onboardingTemplate: 'onboardingTemplate',
  project: 'project',
} as const;

/**
 * Foreign keys arriving from a client must point at THIS tenant's rows; otherwise a caller can
 * link their records to (and then read back) another tenant's data by supplying its id.
 */
export async function assertInTenant(
  prisma: PrismaService,
  tenantId: string,
  refs: { model: keyof typeof MODELS; id?: string | null; label?: string }[],
) {
  for (const ref of refs) {
    if (!ref.id) continue;
    const found = await (prisma as any)[MODELS[ref.model]].findFirst({ where: { id: ref.id, tenantId }, select: { id: true } });
    if (!found) throw new BadRequestException(`Invalid ${ref.label ?? ref.model}`);
  }
}
