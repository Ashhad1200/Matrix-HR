import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { Viewer, isHrPlus, scopedEmployeeIds, employeeIdFilter } from '../common/data-scope';
import { tenantToday } from '../common/tenant-time';
import { ClaimDecisionDto, CreateCategoryDto, CreateClaimDto, ExpenseItemDto, UpdateCategoryDto, UpdateClaimDto } from './dto';

// Policy limits — constants for now, per-tenant configuration is the upgrade path.
const MAX_ITEM_AGE_DAYS = 180;

const claimInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, managerId: true } },
  items: { include: { category: { select: { id: true, name: true } } }, orderBy: { date: 'asc' as const } },
};

@Injectable()
export class ExpensesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private workflow: WorkflowEngineService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    this.workflow.registerHandler('ExpenseClaim', {
      onApproved: (instance) => this.finish(instance.tenantId, instance.entityId, 'APPROVED'),
      onRejected: (instance, reason) => this.finish(instance.tenantId, instance.entityId, 'REJECTED', reason),
    });
  }

  private async finish(tenantId: string, claimId: string, status: 'APPROVED' | 'REJECTED', note?: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id: claimId, tenantId } });
    // A claim cancelled while its workflow was pending must not come back to life.
    if (!claim || claim.status !== 'SUBMITTED') return;
    await this.prisma.expenseClaim.update({
      where: { id: claimId },
      data: { status, decidedAt: new Date(), decisionNote: note },
    });
    await this.notify(tenantId, claim.employeeId, status === 'APPROVED' ? 'Expense claim approved' : 'Expense claim rejected',
      status === 'APPROVED'
        ? `"${claim.title}" was approved and will be reimbursed with your next payroll.`
        : `"${claim.title}" was rejected${note ? `: ${note}` : '.'}`);
  }

  private async notify(tenantId: string, employeeId: string, title: string, body: string) {
    const user = await this.prisma.user.findFirst({ where: { tenantId, employeeId } });
    if (user) await this.notifications.create(tenantId, user.id, title, body);
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  listCategories(tenantId: string, includeInactive = false) {
    return this.prisma.expenseCategory.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    const clash = await this.prisma.expenseCategory.findUnique({ where: { tenantId_name: { tenantId, name: dto.name } } });
    if (clash) throw new ConflictException('A category with that name already exists');
    return this.prisma.expenseCategory.create({
      data: { tenantId, name: dto.name, maxAmountPerItem: dto.maxAmountPerItem, requiresReceipt: dto.requiresReceipt ?? false },
    });
  }

  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    const c = await this.prisma.expenseCategory.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Category not found');
    return this.prisma.expenseCategory.update({ where: { id }, data: dto });
  }

  // ── Claims ─────────────────────────────────────────────────────────────────
  /** Totals and per-item rules are computed here — the client's arithmetic is never trusted. */
  private async normaliseItems(tenantId: string, items: ExpenseItemDto[]) {
    const categories = await this.prisma.expenseCategory.findMany({
      where: { tenantId, id: { in: [...new Set(items.map((i) => i.categoryId))] }, isActive: true },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));
    const today = new Date(await tenantToday(this.prisma, tenantId));
    const oldest = new Date(today.getTime() - MAX_ITEM_AGE_DAYS * 86400000);

    let total = 0;
    const rows = items.map((i, idx) => {
      const cat = byId.get(i.categoryId);
      const label = `Item ${idx + 1}`;
      if (!cat) throw new BadRequestException(`${label}: unknown or inactive category`);
      const date = new Date(i.date.slice(0, 10));
      if (date > today) throw new BadRequestException(`${label}: date cannot be in the future`);
      if (date < oldest) throw new BadRequestException(`${label}: expenses older than ${MAX_ITEM_AGE_DAYS} days cannot be claimed`);
      if (cat.maxAmountPerItem != null && i.amount > Number(cat.maxAmountPerItem)) {
        throw new BadRequestException(`${label}: ${cat.name} is limited to ${Number(cat.maxAmountPerItem)} per item`);
      }
      if (cat.requiresReceipt && !i.receiptUrl) throw new BadRequestException(`${label}: ${cat.name} requires a receipt`);
      total += Math.round(i.amount * 100);
      return { categoryId: i.categoryId, date, amount: i.amount, description: i.description, receiptUrl: i.receiptUrl };
    });
    return { rows, total: total / 100 };
  }

  private requireEmployee(v: Viewer) {
    if (!v.employeeId) throw new ForbiddenException('No employee profile is linked to this account');
    return v.employeeId;
  }

  async createClaim(tenantId: string, viewer: Viewer, dto: CreateClaimDto) {
    const employeeId = this.requireEmployee(viewer);
    const { rows, total } = await this.normaliseItems(tenantId, dto.items);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    return this.prisma.expenseClaim.create({
      data: { tenantId, employeeId, title: dto.title, description: dto.description, totalAmount: total, currency: tenant?.currency ?? 'PKR', items: { create: rows } },
      include: claimInclude,
    });
  }

  private async ownDraft(tenantId: string, viewer: Viewer, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.employeeId !== viewer.employeeId) throw new ForbiddenException('This is not your claim');
    if (claim.status !== 'DRAFT') throw new BadRequestException('Only a draft claim can be edited');
    return claim;
  }

  async updateClaim(tenantId: string, viewer: Viewer, id: string, dto: UpdateClaimDto) {
    await this.ownDraft(tenantId, viewer, id);
    const items = dto.items ? await this.normaliseItems(tenantId, dto.items) : null;
    return this.prisma.$transaction(async (tx) => {
      if (items) await tx.expenseItem.deleteMany({ where: { claimId: id } });
      return tx.expenseClaim.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          ...(items ? { totalAmount: items.total, items: { create: items.rows } } : {}),
        },
        include: claimInclude,
      });
    });
  }

  async deleteClaim(tenantId: string, viewer: Viewer, id: string) {
    await this.ownDraft(tenantId, viewer, id);
    await this.prisma.expenseClaim.delete({ where: { id } });
    return { deleted: true };
  }

  async submitClaim(tenantId: string, viewer: Viewer, id: string) {
    const claim = await this.ownDraft(tenantId, viewer, id);
    const count = await this.prisma.expenseItem.count({ where: { claimId: id } });
    if (count === 0 || Number(claim.totalAmount) <= 0) throw new BadRequestException('Add at least one item before submitting');

    const instance = await this.workflow.start({
      tenantId, trigger: 'expense.claim', entityType: 'ExpenseClaim', entityId: id,
      requestedByUserId: viewer.userId, subjectEmployeeId: claim.employeeId,
    });
    await this.prisma.expenseClaim.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), workflowInstanceId: instance.id },
    });
    await this.audit.log({ tenantId, userId: viewer.userId, action: 'SUBMIT', entity: 'ExpenseClaim', entityId: id, after: { total: Number(claim.totalAmount) } });
    return this.getClaim(tenantId, viewer, id);
  }

  async cancelClaim(tenantId: string, viewer: Viewer, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    const owner = claim.employeeId === viewer.employeeId;
    if (!owner && !isHrPlus(viewer.role)) throw new ForbiddenException('You cannot cancel this claim');
    if (!['DRAFT', 'SUBMITTED'].includes(claim.status)) throw new BadRequestException(`A ${claim.status.toLowerCase()} claim cannot be cancelled`);
    await this.prisma.expenseClaim.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.log({ tenantId, userId: viewer.userId, action: 'CANCEL', entity: 'ExpenseClaim', entityId: id });
    return this.getClaim(tenantId, viewer, id);
  }

  async listClaims(tenantId: string, viewer: Viewer, filters: { status?: string; employeeId?: string } = {}) {
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    return this.prisma.expenseClaim.findMany({
      where: { tenantId, ...employeeIdFilter(allowed, filters.employeeId), ...(filters.status ? { status: filters.status as any } : {}) },
      include: claimInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getClaim(tenantId: string, viewer: Viewer, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, tenantId }, include: claimInclude });
    if (!claim) throw new NotFoundException('Claim not found');
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    if (allowed !== null && !allowed.includes(claim.employeeId)) throw new ForbiddenException('You do not have access to this claim');

    const instance = claim.workflowInstanceId ? await this.workflow.getInstanceOrThrow(tenantId, claim.workflowInstanceId) : null;
    return {
      ...claim,
      approvals: instance && {
        status: instance.status,
        awaitingRole: this.workflow.currentStepRole(instance),
        history: instance.actions,
      },
    };
  }

  /** Submitted claims this person is expected to act on (their reports' for managers; everyone else's for HR). */
  async inbox(tenantId: string, viewer: Viewer) {
    const hr = isHrPlus(viewer.role);
    if (!hr && !viewer.employeeId) return [];
    return this.prisma.expenseClaim.findMany({
      where: {
        tenantId,
        status: 'SUBMITTED',
        ...(viewer.employeeId ? { NOT: { employeeId: viewer.employeeId } } : {}),
        ...(hr ? {} : { employee: { managerId: viewer.employeeId! } }),
      },
      include: claimInclude,
      orderBy: { submittedAt: 'asc' },
    });
  }

  async decide(tenantId: string, viewer: Viewer, id: string, dto: ClaimDecisionDto) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== 'SUBMITTED' || !claim.workflowInstanceId) throw new BadRequestException('This claim is not awaiting a decision');
    await this.workflow.act(tenantId, claim.workflowInstanceId, viewer, dto.action, dto.comment);
    await this.audit.log({ tenantId, userId: viewer.userId, action: dto.action, entity: 'ExpenseClaim', entityId: id, after: { comment: dto.comment } });
    return this.getClaim(tenantId, viewer, id);
  }
}
