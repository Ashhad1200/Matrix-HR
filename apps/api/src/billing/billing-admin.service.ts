import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailOutboxService } from '../mail/mail.service';
import { CreditsService, creditsToMc } from '../credits/credits.service';
import { BillingService } from './billing.service';
import { addMonths } from './lifecycle';
import { receiptNumber } from './billing.config';
import { AccountDto, ApproveDto, GrantCreditsDto, PackEditDto, PeriodDto, PlanEditDto, RejectDto, SettingsDto } from './dto';

const cents = (n: unknown) => Math.round(Number(n) * 100);
const money = (c: number) => (c / 100).toFixed(2);

/** Cross-tenant operator tooling (SUPER_ADMIN only). Everything that changes money, access or catalog is audited. */
@Injectable()
export class BillingAdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private outbox: EmailOutboxService,
    private credits: CreditsService,
    private billing: BillingService,
  ) {}

  private platformAudit(operatorUserId: string, action: string, targetType: string, targetId: string, detail?: unknown) {
    return this.prisma.platformAuditLog.create({ data: { operatorUserId, action, targetType, targetId, detail: detail as any } });
  }

  // ── Queue and history ────────────────────────────────────────────────────────────────────────────
  private async rows(where: object, take: number) {
    const rs = await this.prisma.paymentRequest.findMany({
      where, orderBy: { createdAt: 'desc' }, take,
      include: { tenant: { select: { name: true, subdomain: true, subscription: { select: { currentPeriodEnd: true, status: true, planVersion: { select: { plan: { select: { code: true } } } } } } } }, account: { select: { label: true, currency: true } }, proof: { select: { id: true, mime: true, size: true } }, receipt: { select: { number: true } } },
    });
    return rs.map((r) => ({
      id: r.id, reference: r.reference, status: r.status, purpose: r.purpose, planCode: r.planCode, billingPeriod: r.billingPeriod, packCode: r.packCode,
      currency: r.currency, expectedAmount: money(cents(r.expectedAmount)), declaredAmount: r.declaredAmount != null ? money(cents(r.declaredAmount)) : null, declaredCurrency: r.declaredCurrency,
      mismatch: r.declaredAmount != null && (money(cents(r.declaredAmount)) !== money(cents(r.expectedAmount)) || (r.declaredCurrency != null && r.declaredCurrency !== r.currency)),
      customerNote: r.customerNote, lineItems: r.lineItems, createdAt: r.createdAt, reviewedAt: r.reviewedAt, reviewReason: r.reviewReason, rejectReason: r.rejectReason,
      approvedAmount: r.approvedAmount != null ? money(cents(r.approvedAmount)) : null, periodStartAt: r.periodStartAt, periodEndAt: r.periodEndAt, creditsGranted: r.creditsGranted,
      tenant: { id: r.tenantId, name: r.tenant.name, subdomain: r.tenant.subdomain },
      currentPeriodEnd: r.tenant.subscription?.currentPeriodEnd ?? null, currentPlan: r.tenant.subscription?.planVersion.plan.code ?? null,
      account: r.account, proof: r.proof, receiptNumber: r.receipt?.number ?? null,
    }));
  }
  queue() { return this.rows({ status: 'PENDING' }, 200); }
  history(status?: string, tenantId?: string) {
    return this.rows({ status: status ? status : { in: ['APPROVED', 'REJECTED', 'CANCELLED'] }, ...(tenantId ? { tenantId } : {}) }, 300);
  }

  async proof(id: string) {
    const p = await this.prisma.paymentProof.findUnique({ where: { requestId: id } });
    if (!p) throw new NotFoundException('No proof uploaded');
    return p;
  }

  async receipt(id: string) {
    const r = await this.prisma.paymentRequest.findUnique({ where: { id }, include: { receipt: true, tenant: { select: { name: true, subdomain: true } } } });
    if (!r?.receipt) throw new NotFoundException('No receipt');
    return this.billing.receiptBody(r, r.receipt, r.tenant);
  }

  // ── Approve: ONE transaction, idempotent ─────────────────────────────────────────────────────────
  async approve(operatorId: string, id: string, dto: ApproveDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Row lock: a concurrent second approval waits here, then sees APPROVED and does nothing.
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "PaymentRequest" WHERE id = ${id} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException('Payment request not found');
      const req = await tx.paymentRequest.findUniqueOrThrow({ where: { id }, include: { receipt: true, tenant: { select: { id: true, name: true } } } });
      if (locked[0].status === 'APPROVED') return { already: true as const, req };
      if (locked[0].status !== 'PENDING') throw new BadRequestException(`A ${locked[0].status.toLowerCase().replace('_', ' ')} request cannot be approved`);

      const expected = cents(req.expectedAmount);
      const approved = dto.approvedAmount != null ? cents(dto.approvedAmount) : expected;
      if (approved !== expected && !dto.reason?.trim()) throw new BadRequestException('Approving a different amount than the price needs a reason');
      if (dto.periodEnd && !dto.reason?.trim()) throw new BadRequestException('Changing the period needs a reason');
      if (dto.periodEnd && req.purpose !== 'plan') throw new BadRequestException('Only plan requests have a period');

      const now = new Date();
      let periodStartAt: Date | null = null;
      let periodEndAt: Date | null = null;
      let creditsGranted: number | null = null;

      if (req.purpose === 'plan') {
        const planVersionId = req.planVersionId;
        if (!planVersionId) throw new BadRequestException('Request has no plan');
        const sub = await tx.subscription.findUnique({ where: { tenantId: req.tenantId } });
        // Extend from the current end if it is still in the future, otherwise from now (lapsed, expired trial, no clock).
        const from = sub?.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
        periodStartAt = from;
        periodEndAt = dto.periodEnd ? new Date(dto.periodEnd) : addMonths(from, req.billingPeriod === 'yearly' ? 12 : 1);
        if (periodEndAt <= now) throw new BadRequestException('The new period end must be in the future');
        const pv = await tx.planVersion.findUniqueOrThrow({ where: { id: planVersionId } });
        await tx.subscription.upsert({
          where: { tenantId: req.tenantId },
          create: { tenantId: req.tenantId, planVersionId, status: 'active', currentPeriodEnd: periodEndAt, billingPeriod: req.billingPeriod ?? 'monthly' },
          update: { planVersionId, status: 'active', currentPeriodEnd: periodEndAt, billingPeriod: req.billingPeriod ?? 'monthly', cancelledAt: null },
        });
        // Provisional access (if any) was for the old period end; it is moot now that the period moved.
        if (pv.aiCreditsMonthly > 0) {
          await this.credits.setMonthly(tx, { tenantId: req.tenantId, mc: creditsToMc(pv.aiCreditsMonthly), resetAt: addMonths(now, 1), key: `monthly:req:${id}`, kind: 'MONTHLY', refId: id });
        }
      } else {
        const pack = await tx.creditPack.findUnique({ where: { code: req.packCode ?? '' } });
        if (!pack) throw new BadRequestException('Credit pack no longer exists');
        creditsGranted = pack.credits;
        await this.credits.add(tx, { tenantId: req.tenantId, mc: creditsToMc(pack.credits), bucket: 'purchased', kind: 'PURCHASE', key: `pack:${id}`, refId: id });
      }

      const year = now.getUTCFullYear();
      const counter = await tx.$queryRaw<{ last: number }[]>`INSERT INTO "ReceiptCounter" (year,last) VALUES (${year}, 1) ON CONFLICT (year) DO UPDATE SET last = "ReceiptCounter".last + 1 RETURNING last`;
      const number = receiptNumber(year, Number(counter[0].last));
      await tx.receipt.create({ data: { requestId: id, tenantId: req.tenantId, number, amount: money(approved), currency: req.currency } });
      const updated = await tx.paymentRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedByUserId: operatorId, reviewedAt: now, approvedAmount: money(approved), reviewReason: dto.reason?.trim() || null, periodStartAt, periodEndAt, creditsGranted },
      });
      await tx.platformAuditLog.create({ data: { operatorUserId: operatorId, action: 'APPROVE_PAYMENT', targetType: 'PaymentRequest', targetId: id, detail: { tenantId: req.tenantId, reference: req.reference, expected: money(expected), approved: money(approved), reason: dto.reason ?? null, receipt: number, periodEndAt, creditsGranted } as any } });
      await tx.auditLog.create({ data: { tenantId: req.tenantId, action: 'PAYMENT_APPROVED', entity: 'PaymentRequest', entityId: id, after: { receipt: number, periodEndAt, creditsGranted } as any } });
      return { already: false as const, req: updated, receiptNumber: number, tenantId: req.tenantId, tenantName: req.tenant.name, periodEndAt, creditsGranted, purpose: req.purpose };
    });

    if (!result.already) await this.emailTenantAdmins(result.tenantId, `approved:${id}`, `Payment received: ${result.req.reference}`,
      `Thank you. We have approved your payment ${result.req.reference}.\n${result.purpose === 'plan' ? `Your plan now runs until ${result.periodEndAt!.toISOString().slice(0, 10)}.` : `${result.creditsGranted!.toLocaleString('en-US')} AI credits were added.`}\nReceipt: ${result.receiptNumber}\nYou can print it from Billing in MatrixHR.\n`);
    return this.rows({ id }, 1).then((r) => r[0]);
  }

  async reject(operatorId: string, id: string, dto: RejectDto) {
    if ((dto.reason ?? '').trim().length < 5) throw new BadRequestException('A rejection needs a reason');
    const tenantId = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string; tenantId: string }[]>`SELECT status, "tenantId" FROM "PaymentRequest" WHERE id = ${id} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException('Payment request not found');
      if (locked[0].status === 'REJECTED') return locked[0].tenantId; // idempotent
      if (locked[0].status !== 'PENDING') throw new BadRequestException('Only a request waiting for review can be rejected');
      const now = new Date();
      await tx.paymentRequest.update({ where: { id }, data: { status: 'REJECTED', rejectReason: dto.reason.trim(), reviewedByUserId: operatorId, reviewedAt: now } });
      // Ends any provisional window immediately.
      const sub = await tx.subscription.findUnique({ where: { tenantId: locked[0].tenantId } });
      if (sub) await tx.provisionalAccess.updateMany({ where: { subscriptionId: sub.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.platformAuditLog.create({ data: { operatorUserId: operatorId, action: 'REJECT_PAYMENT', targetType: 'PaymentRequest', targetId: id, detail: { tenantId: locked[0].tenantId, reason: dto.reason } as any } });
      await tx.auditLog.create({ data: { tenantId: locked[0].tenantId, action: 'PAYMENT_REJECTED', entity: 'PaymentRequest', entityId: id, after: { reason: dto.reason } as any } });
      return locked[0].tenantId;
    });
    await this.emailTenantAdmins(tenantId, `rejected:${id}`, 'We could not verify your payment', `We could not approve your payment request.\nReason: ${dto.reason.trim()}\nPlease start a new request from Billing in MatrixHR, or reply to this email.\n`);
    return this.rows({ id }, 1).then((r) => r[0]);
  }

  private async emailTenantAdmins(tenantId: string, dedupe: string, subject: string, body: string) {
    const admins = await this.prisma.user.findMany({ where: { tenantId, role: { in: ['COMPANY_ADMIN', 'HR_MANAGER'] }, status: 'ACTIVE' }, select: { email: true } });
    for (const a of admins) await this.outbox.enqueue({ to: a.email, subject, body, tenantId, dedupeKey: `${dedupe}:${a.email}` }).catch(() => {});
  }

  // ── Payment accounts (none seeded) ───────────────────────────────────────────────────────────────
  accounts() { return this.prisma.paymentAccount.findMany({ orderBy: { createdAt: 'asc' } }); }
  async createAccount(op: string, dto: AccountDto) {
    if (!dto.iban && !dto.accountNumber) throw new BadRequestException('Add an IBAN or an account number');
    const a = await this.prisma.paymentAccount.create({ data: { ...dto, currency: dto.currency?.toUpperCase() ?? 'USD' } });
    await this.platformAudit(op, 'CREATE_PAYMENT_ACCOUNT', 'PaymentAccount', a.id, { label: a.label, bankName: a.bankName });
    return a;
  }
  async updateAccount(op: string, id: string, dto: Partial<AccountDto>) {
    const before = await this.prisma.paymentAccount.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Account not found');
    const a = await this.prisma.paymentAccount.update({ where: { id }, data: { ...dto, ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}) } });
    await this.platformAudit(op, 'UPDATE_PAYMENT_ACCOUNT', 'PaymentAccount', id, { before: { label: before.label, isActive: before.isActive, iban: before.iban }, after: dto });
    return a;
  }

  // ── Settings ─────────────────────────────────────────────────────────────────────────────────────
  settings() { return this.billing.settings(); }
  async updateSettings(op: string, dto: SettingsDto) {
    const before = await this.billing.settings();
    await this.prisma.billingSettings.upsert({ where: { id: 'singleton' }, update: dto, create: { id: 'singleton', ...dto } });
    await this.platformAudit(op, 'UPDATE_BILLING_SETTINGS', 'BillingSettings', 'singleton', { before: { graceDays: before.graceDays, provisionalHours: before.provisionalHours, reminderDays: before.reminderDays }, after: dto });
    return this.billing.settings();
  }

  // ── Plan editor and credit packs ─────────────────────────────────────────────────────────────────
  async plans() {
    const plans = await this.prisma.plan.findMany({ orderBy: { createdAt: 'asc' }, include: { versions: { orderBy: { version: 'desc' } } } });
    const subs = await this.prisma.subscription.groupBy({ by: ['planVersionId'], _count: { _all: true } });
    const count = new Map(subs.map((s) => [s.planVersionId, s._count._all]));
    return plans.map((p) => ({
      code: p.code, name: p.name, isActive: p.isActive,
      versions: p.versions.map((v) => ({
        id: v.id, version: v.version, isCurrent: v.isCurrent, offeredToNew: v.offeredToNew, currency: v.currency,
        priceMonthly: v.priceMonthly?.toString() ?? null, priceYearly: v.priceYearly?.toString() ?? null,
        legacyPricePkrMonthly: v.pricePkrMonthly?.toString() ?? null,
        aiCreditsMonthly: v.aiCreditsMonthly, maxEmployees: v.maxEmployees, maxAdminUsers: v.maxAdminUsers, overagePerEmployee: v.overagePerEmployee?.toString() ?? null,
        subscribers: count.get(v.id) ?? 0,
      })),
    }));
  }

  /** Edits the plan's CURRENT version in place. Paid periods already issued are unaffected: amounts are frozen on each request. */
  async editPlan(op: string, code: string, dto: PlanEditDto) {
    const plan = await this.prisma.plan.findUnique({ where: { code }, include: { versions: { where: { isCurrent: true } } } });
    const v = plan?.versions[0];
    if (!plan || !v) throw new NotFoundException('Plan not found');
    if (dto.priceYearly != null && dto.priceMonthly == null && !v.priceMonthly) throw new BadRequestException('Set a monthly price too');
    const { isActive, ...ver } = dto;
    const data = { ...ver, ...(ver.currency ? { currency: ver.currency.toUpperCase() } : {}) };
    const before = { currency: v.currency, priceMonthly: v.priceMonthly?.toString(), priceYearly: v.priceYearly?.toString(), aiCreditsMonthly: v.aiCreditsMonthly, maxEmployees: v.maxEmployees, maxAdminUsers: v.maxAdminUsers, overagePerEmployee: v.overagePerEmployee?.toString(), offeredToNew: v.offeredToNew, isActive: plan.isActive };
    await this.prisma.$transaction([
      this.prisma.planVersion.update({ where: { id: v.id }, data }),
      ...(isActive != null ? [this.prisma.plan.update({ where: { id: plan.id }, data: { isActive } })] : []),
    ]);
    await this.platformAudit(op, 'EDIT_PLAN', 'Plan', plan.id, { code, before, after: dto });
    return (await this.plans()).find((p) => p.code === code);
  }

  async packs() { return (await this.prisma.creditPack.findMany({ orderBy: { price: 'asc' } })).map((p) => ({ ...p, price: p.price.toString() })); }
  async editPack(op: string, code: string, dto: PackEditDto) {
    const before = await this.prisma.creditPack.findUnique({ where: { code } });
    if (!before) throw new NotFoundException('Pack not found');
    const p = await this.prisma.creditPack.update({ where: { code }, data: dto });
    await this.platformAudit(op, 'EDIT_CREDIT_PACK', 'CreditPack', p.id, { code, before: { name: before.name, credits: before.credits, price: before.price.toString(), isActive: before.isActive }, after: dto });
    return { ...p, price: p.price.toString() };
  }

  // ── Manual renewal clock, credit grants, usage ───────────────────────────────────────────────────
  /**
   * Gives an existing tenant (or clears) a billing clock. Until an operator does this, a tenant without a period end can
   * never lapse, get a banner, or get a reminder email.
   */
  async setPeriod(op: string, tenantId: string, dto: PeriodDto) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('This tenant has no subscription. Assign a plan first (Tenants > Plan).');
    const periodEnd = dto.periodEnd === undefined ? undefined : dto.periodEnd === null ? null : new Date(dto.periodEnd);
    if (periodEnd === undefined && !dto.billingPeriod) throw new BadRequestException('Nothing to change');
    const updated = await this.prisma.subscription.update({ where: { tenantId }, data: { ...(periodEnd !== undefined ? { currentPeriodEnd: periodEnd } : {}), ...(dto.billingPeriod ? { billingPeriod: dto.billingPeriod } : {}) } });
    await this.platformAudit(op, 'SET_PERIOD', 'Tenant', tenantId, { before: sub.currentPeriodEnd, after: updated.currentPeriodEnd, reason: dto.reason });
    await this.audit.log({ tenantId, action: 'BILLING_PERIOD_SET', entity: 'Subscription', entityId: sub.id, after: { currentPeriodEnd: updated.currentPeriodEnd } });
    return { currentPeriodEnd: updated.currentPeriodEnd, billingPeriod: updated.billingPeriod };
  }

  async grantCredits(op: string, tenantId: string, dto: GrantCreditsDto) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!t) throw new NotFoundException('Tenant not found');
    const applied = await this.credits.add(this.prisma, { tenantId, mc: creditsToMc(dto.credits), bucket: 'purchased', kind: 'GRANT', key: `grant:${tenantId}:${dto.idempotencyKey}`, detail: { reason: dto.reason }, userId: op });
    if (applied) await this.platformAudit(op, 'GRANT_CREDITS', 'Tenant', tenantId, { credits: dto.credits, reason: dto.reason, idempotencyKey: dto.idempotencyKey });
    return { applied, ...(await this.credits.balance(tenantId)) };
  }

  async usage(tenantId?: string) {
    const rows = await this.prisma.$queryRaw<{ tenantId: string; name: string; kind: string; mc: bigint; n: bigint }[]>`
      SELECT l."tenantId", t.name, l.kind, SUM(l."deltaMc") AS mc, COUNT(*) AS n
        FROM "AiCreditLedger" l JOIN "Tenant" t ON t.id = l."tenantId"
       WHERE (${tenantId ?? null}::text IS NULL OR l."tenantId" = ${tenantId ?? null})
       GROUP BY l."tenantId", t.name, l.kind ORDER BY t.name`;
    const by = new Map<string, any>();
    for (const r of rows) {
      const e = by.get(r.tenantId) ?? { tenantId: r.tenantId, name: r.name, calls: 0, creditsUsed: 0, creditsGranted: 0, creditsPurchased: 0 };
      const credits = Number(r.mc) / 1000;
      if (r.kind === 'RESERVE') e.calls += Number(r.n);
      if (r.kind === 'RESERVE' || r.kind === 'SETTLE' || r.kind === 'REFUND') e.creditsUsed += -credits; // net spend
      if (r.kind === 'GRANT' || r.kind === 'MONTHLY' || r.kind === 'TRIAL') e.creditsGranted += credits;
      if (r.kind === 'PURCHASE') e.creditsPurchased += credits;
      by.set(r.tenantId, e);
    }
    const out = [...by.values()];
    for (const e of out) e.balance = (await this.credits.balance(e.tenantId)).credits;
    return out;
  }

  async tenantBilling(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!t) throw new NotFoundException('Tenant not found');
    return { state: await this.billing.state(tenantId), credits: await this.credits.balance(tenantId), requests: await this.billing.listRequests(tenantId) };
  }

  /** Per-tenant read-only snapshot for the "quiet first cycle" report: who has a clock, who could be affected. */
  async clockReport() {
    const rows = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, subdomain: true, status: true, subscription: { select: { status: true, currentPeriodEnd: true, trialEndsAt: true, planVersion: { select: { currency: true, plan: { select: { code: true } } } } } } },
    });
    return rows.map((t) => ({ id: t.id, name: t.name, subdomain: t.subdomain, status: t.status, plan: t.subscription?.planVersion.plan.code ?? null, currency: t.subscription?.planVersion.currency ?? null, subscriptionStatus: t.subscription?.status ?? null, currentPeriodEnd: t.subscription?.currentPeriodEnd ?? null, hasClock: !!t.subscription?.currentPeriodEnd }));
  }
}
