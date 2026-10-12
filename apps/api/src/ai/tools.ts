import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveService } from '../leave/leave.service';
import { Viewer, isHrPlus, scopedEmployeeIds } from '../common/data-scope';
import type { ToolSpec } from './providers';

export interface ToolCtx { tenantId: string; user: { id: string; role: string; employeeId?: string | null }; prisma: PrismaService; leave: LeaveService }
export interface ToolDef {
  spec: ToolSpec;
  /** Roles allowed to call it. The role is checked again when a write is confirmed, and each underlying service still applies its own rules. */
  roles: string[] | 'any';
  kind: 'read' | 'write';
  describe?: (a: any) => string;
  run: (ctx: ToolCtx, args: any) => Promise<unknown>;
}

const MGR = ['MANAGER', 'HR_MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'];
const viewer = (c: ToolCtx): Viewer => ({ userId: c.user.id, role: c.user.role, employeeId: c.user.employeeId });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });
const date = (v: unknown, label: string) => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequestException(`${label} must be a date like 2026-03-01`); return v; };
const str = (v: unknown, label: string, max = 300) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new BadRequestException(`${label} is required`); return v.trim(); };

// No tool deletes anything, and none touches payroll runs, salaries or bank details: those stay manual by design.
export const TOOLS: ToolDef[] = [
  {
    spec: { name: 'my_leave_balances', description: 'Leave balances (entitled, used, pending, remaining) of the person asking, for this year.', parameters: obj({}) },
    roles: 'any', kind: 'read',
    run: async (c) => (await c.leave.getBalances(c.tenantId, c.user.employeeId)).map((b: any) => ({ leaveType: b.policy.name, policyId: b.policyId, entitled: Number(b.entitled), used: Number(b.used), pending: Number(b.pending), remaining: Number(b.entitled) - Number(b.used) - Number(b.pending) })),
  },
  {
    spec: { name: 'leave_policies', description: 'The company\'s leave types and their yearly days. Returns policy ids needed to request leave.', parameters: obj({}) },
    roles: 'any', kind: 'read',
    run: async (c) => (await c.leave.getPolicies(c.tenantId)).map((p: any) => ({ policyId: p.id, name: p.name, daysPerYear: Number(p.daysPerYear) })),
  },
  {
    spec: { name: 'holidays', description: 'Public holidays of the company for a year (default this year).', parameters: obj({ year: { type: 'integer' } }) },
    roles: 'any', kind: 'read',
    run: async (c, a) => (await c.leave.getHolidays(c.tenantId, Number.isInteger(a?.year) ? a.year : undefined)).map((h: any) => ({ name: h.name, date: h.date.toISOString().slice(0, 10) })),
  },
  {
    spec: { name: 'my_leave_requests', description: 'Leave requests of the person asking (or, for managers and HR, requests they can see), optionally by status.', parameters: obj({ status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] } }) },
    roles: 'any', kind: 'read',
    run: async (c, a) => (await c.leave.getRequests(c.tenantId, { status: a?.status, ...(isHrPlus(c.user.role) || c.user.role === 'MANAGER' ? {} : { employeeId: c.user.employeeId ?? undefined }) }, viewer(c))).slice(0, 25).map((r: any) => ({ requestId: r.id, employee: `${r.employee.firstName} ${r.employee.lastName}`, leaveType: r.policy.name, from: r.startDate.toISOString().slice(0, 10), to: r.endDate.toISOString().slice(0, 10), days: Number(r.days), status: r.status })),
  },
  {
    spec: { name: 'find_employees', description: 'Directory search by name (name, department, job title only). Shows only people the asker is allowed to see.', parameters: obj({ name: { type: 'string' } }, ['name']) },
    roles: MGR, kind: 'read',
    run: async (c, a) => {
      const allowed = await scopedEmployeeIds(c.prisma, c.tenantId, viewer(c));
      const rows = await c.prisma.employee.findMany({
        where: { tenantId: c.tenantId, ...(allowed ? { id: { in: allowed } } : {}), OR: [{ firstName: { contains: str(a?.name, 'name', 60), mode: 'insensitive' } }, { lastName: { contains: str(a?.name, 'name', 60), mode: 'insensitive' } }] },
        select: { id: true, firstName: true, lastName: true, department: { select: { name: true } }, designation: { select: { name: true } } }, take: 10,
      });
      return rows.map((r) => ({ employeeId: r.id, name: `${r.firstName} ${r.lastName}`, department: r.department?.name ?? null, jobTitle: r.designation?.name ?? null }));
    },
  },
  {
    spec: { name: 'headcount', description: 'Number of active employees in the company.', parameters: obj({}) },
    roles: ['HR_MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'], kind: 'read',
    run: async (c) => ({ activeEmployees: await c.prisma.employee.count({ where: { tenantId: c.tenantId, status: 'ACTIVE' as any } }) }),
  },
  {
    spec: { name: 'request_leave', description: 'Prepare a leave request for the person asking. The user must confirm before it is submitted.', parameters: obj({ policyId: { type: 'string' }, startDate: { type: 'string', description: 'YYYY-MM-DD' }, endDate: { type: 'string', description: 'YYYY-MM-DD' }, isHalfDay: { type: 'boolean' }, reason: { type: 'string' } }, ['policyId', 'startDate', 'endDate']) },
    roles: 'any', kind: 'write',
    describe: (a) => `Submit a leave request from ${a.startDate} to ${a.endDate}${a.isHalfDay ? ' (half day)' : ''}${a.reason ? ` - "${String(a.reason).slice(0, 80)}"` : ''}`,
    run: async (c, a) => {
      if (!c.user.employeeId) throw new BadRequestException('Your login is not linked to an employee record');
      const r: any = await c.leave.createRequest(c.tenantId, c.user.employeeId, { policyId: str(a.policyId, 'policyId', 60), startDate: date(a.startDate, 'startDate'), endDate: date(a.endDate, 'endDate'), isHalfDay: a.isHalfDay === true, reason: a.reason ? String(a.reason).slice(0, 500) : undefined } as any, c.user.id);
      return { requestId: r?.id, status: r?.status };
    },
  },
  {
    spec: { name: 'decide_leave_request', description: 'Prepare approving or rejecting a leave request. The user must confirm first.', parameters: obj({ requestId: { type: 'string' }, decision: { type: 'string', enum: ['approve', 'reject'] }, reason: { type: 'string' } }, ['requestId', 'decision']) },
    roles: MGR, kind: 'write',
    describe: (a) => `${a.decision === 'approve' ? 'Approve' : 'Reject'} leave request ${a.requestId}${a.reason ? ` ("${String(a.reason).slice(0, 80)}")` : ''}`,
    run: async (c, a) => {
      const actor = { userId: c.user.id, role: c.user.role, employeeId: c.user.employeeId };
      const id = str(a.requestId, 'requestId', 60);
      const r: any = a.decision === 'approve' ? await c.leave.approveRequest(c.tenantId, id, actor) : a.decision === 'reject' ? await c.leave.rejectRequest(c.tenantId, id, actor, a.reason ? String(a.reason).slice(0, 300) : undefined) : (() => { throw new BadRequestException('decision must be approve or reject'); })();
      return { requestId: r?.id, status: r?.status };
    },
  },
];

export const toolByName = (n: string) => TOOLS.find((t) => t.spec.name === n);
export const allowed = (t: ToolDef, role: string) => t.roles === 'any' || t.roles.includes(role);
export const toolsFor = (role: string) => TOOLS.filter((t) => allowed(t, role));
