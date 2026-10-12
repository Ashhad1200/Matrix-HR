import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailOutboxService } from '../mail/mail.service';
import { CreditsService, creditsToMc } from '../credits/credits.service';
import { computeLifecycle, Lifecycle } from './lifecycle';
import {
  GRACE_DEFAULT_DAYS, OPEN_REQUEST_STATUSES, PROOF_MAX_BYTES, PROVISIONAL_DEFAULT_HOURS, receiptIssuer, REFERENCE_ALPHABET,
  TRIAL_CREDITS, TRIAL_DAYS, sniffProof,
} from './billing.config';
import { CreateRequestDto, UploadProofDto } from './dto';

const cents = (n: unknown) => Math.round(Number(n) * 100);
const money = (c: number) => (c / 100).toFixed(2);

export interface QuoteLine { label: string; amount: string }
export interface Quote {
  purpose: 'plan' | 'credit_pack';
  currency: string;
  expectedAmount: string;
  lineItems: QuoteLine[];
  planCode?: string;
  planVersionId?: string;
  billingPeriod?: 'monthly' | 'yearly';
  packCode?: string;
  credits?: number;
}

/** Whether this tenant's open requests, trial and period let it use the product. Shared by the gate and /billing/state. */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private outbox: EmailOutboxService,
    private credits: CreditsService,
  ) {}

  async settings() {
    const s = await this.prisma.billingSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
    return { ...s, reminderDaysList: s.reminderDays.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n >= 0) };
  }

  // ── State (banner, lapsed screen) ────────────────────────────────────────────────────────────────
  async lifecycleFor(tenantId: string): Promise<{ lifecycle: Lifecycle; sub: { id: string; status: string; planName: string; planCode: string; billingPeriod: string; trialEndsAt: Date | null } | null }> {
    const [settings, sub] = await Promise.all([
      this.settings(),
      this.prisma.subscription.findUnique({ where: { tenantId }, include: { planVersion: { include: { plan: true } } } }),
    ]);
    let provisionalUntil: Date | null = null;
    if (sub?.currentPeriodEnd) {
      const p = await this.prisma.provisionalAccess.findUnique({ where: { subscriptionId_periodEnd: { subscriptionId: sub.id, periodEnd: sub.currentPeriodEnd } } });
      if (p && !p.revokedAt) provisionalUntil = p.until;
    }
    const lifecycle = computeLifecycle({ now: new Date(), periodEnd: sub?.currentPeriodEnd, graceDays: settings.graceDays ?? GRACE_DEFAULT_DAYS, provisionalUntil });
    return {
      lifecycle,
      sub: sub ? { id: sub.id, status: sub.status, planName: sub.planVersion.plan.name, planCode: sub.planVersion.plan.code, billingPeriod: sub.billingPeriod, trialEndsAt: sub.trialEndsAt } : null,
    };
  }

  async state(tenantId: string) {
    const { lifecycle, sub } = await this.lifecycleFor(tenantId);
    const [open, latest] = await Promise.all([
      this.prisma.paymentRequest.findFirst({ where: { tenantId, status: { in: [...OPEN_REQUEST_STATUSES] } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, purpose: true, reference: true } }),
      this.prisma.paymentRequest.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, rejectReason: true, reviewedAt: true } }),
    ]);
    const recentlyRejected = latest?.status === 'REJECTED' && latest.reviewedAt && Date.now() - latest.reviewedAt.getTime() < 14 * 86_400_000;
    // One banner at a time, most important first. 'none'/'ok' tenants only ever see pending/rejected feedback.
    let banner: 'lapsed' | 'provisional' | 'pending' | 'rejected' | 'grace' | 'due_soon' | null = null;
    if (lifecycle.state === 'lapsed') banner = 'lapsed';
    else if (open?.status === 'PENDING') banner = lifecycle.state === 'provisional' ? 'provisional' : 'pending';
    else if (lifecycle.state === 'provisional') banner = 'provisional';
    else if (recentlyRejected && !open && lifecycle.state !== 'ok' && lifecycle.state !== 'none') banner = 'rejected';
    else if (lifecycle.state === 'grace') banner = 'grace';
    else if (lifecycle.state === 'due_soon') banner = 'due_soon';
    return {
      state: lifecycle.state,
      blocked: lifecycle.blocked,
      banner,
      periodEnd: lifecycle.periodEnd,
      graceEndsAt: lifecycle.graceEndsAt,
      daysToEnd: lifecycle.daysToEnd,
      provisionalUntil: lifecycle.provisionalUntil,
      subscription: sub && { planName: sub.planName, planCode: sub.planCode, status: sub.status, billingPeriod: sub.billingPeriod, trialEndsAt: sub.trialEndsAt },
      openRequest: open,
      rejectedReason: recentlyRejected ? latest?.rejectReason ?? null : null,
    };
  }

  // ── Catalog and quotes (amounts are ALWAYS computed here from the database, never taken from the client) ─────────
  async catalog(tenantId: string) {
    const [versions, packs, accounts, activeEmployees] = await Promise.all([
      this.prisma.planVersion.findMany({
        where: { isCurrent: true, offeredToNew: true, currency: 'USD', priceMonthly: { not: null }, plan: { isActive: true } },
        include: { plan: true },
        orderBy: { priceMonthly: 'asc' },
      }),
      this.prisma.creditPack.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } }),
      this.prisma.paymentAccount.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true, label: true, bankName: true, accountTitle: true, accountNumber: true, iban: true, swift: true, currency: true, instructions: true } }),
      this.prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } }),
    ]);
    return {
      activeEmployees,
      plans: versions.map((v) => ({
        code: v.plan.code, name: v.plan.name, currency: v.currency,
        monthly: v.priceMonthly!.toString(), yearly: v.priceYearly?.toString() ?? null,
        aiCreditsMonthly: v.aiCreditsMonthly, maxEmployees: v.maxEmployees, maxAdminUsers: v.maxAdminUsers,
        overagePerEmployee: v.overagePerEmployee?.toString() ?? null,
      })),
      creditPacks: packs.map((p) => ({ code: p.code, name: p.name, credits: p.credits, price: p.price.toString(), currency: p.currency })),
      accounts,
    };
  }

  async quote(tenantId: string, dto: { purpose: 'plan' | 'credit_pack'; planCode?: string; period?: 'monthly' | 'yearly'; packCode?: string }): Promise<Quote> {
    if (dto.purpose === 'credit_pack') {
      if (!dto.packCode) throw new BadRequestException('packCode is required');
      const pack = await this.prisma.creditPack.findFirst({ where: { code: dto.packCode, isActive: true } });
      if (!pack) throw new NotFoundException('Credit pack not found');
      return {
        purpose: 'credit_pack', currency: pack.currency, expectedAmount: money(cents(pack.price)),
        lineItems: [{ label: `${pack.name}: ${pack.credits.toLocaleString('en-US')} AI credits`, amount: money(cents(pack.price)) }],
        packCode: pack.code, credits: pack.credits,
      };
    }
    if (!dto.planCode || !dto.period) throw new BadRequestException('planCode and period are required');
    const v = await this.prisma.planVersion.findFirst({
      where: { isCurrent: true, offeredToNew: true, currency: 'USD', plan: { code: dto.planCode, isActive: true } },
      include: { plan: true },
    });
    const base = dto.period === 'yearly' ? v?.priceYearly : v?.priceMonthly;
    if (!v || !base) throw new NotFoundException('That plan is not available');

    const active = await this.prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } });
    const lines: QuoteLine[] = [{ label: `${v.plan.name}, ${dto.period === 'yearly' ? '12 months' : '1 month'}`, amount: money(cents(base)) }];
    let total = cents(base);
    if (v.maxEmployees != null && active > v.maxEmployees) {
      if (v.overagePerEmployee == null) {
        throw new BadRequestException(`You have ${active} active employees and ${v.plan.name} allows up to ${v.maxEmployees}. Choose a larger plan.`);
      }
      const extra = active - v.maxEmployees;
      const months = dto.period === 'yearly' ? 12 : 1;
      const over = extra * cents(v.overagePerEmployee) * months;
      total += over;
      lines.push({ label: `${extra} employee${extra === 1 ? '' : 's'} over ${v.maxEmployees} at ${v.currency} ${Number(v.overagePerEmployee).toFixed(2)} for ${months} month${months === 1 ? '' : 's'}`, amount: money(over) });
    }
    return { purpose: 'plan', currency: v.currency, expectedAmount: money(total), lineItems: lines, planCode: v.plan.code, planVersionId: v.id, billingPeriod: dto.period };
  }

  // ── Requests ─────────────────────────────────────────────────────────────────────────────────────
  private async newReference(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const b = randomBytes(8);
      const ref = 'MHR-' + Array.from(b.subarray(0, 6)).map((x) => REFERENCE_ALPHABET[x % REFERENCE_ALPHABET.length]).join('');
      if (!(await this.prisma.paymentRequest.findUnique({ where: { reference: ref }, select: { id: true } }))) return ref;
    }
    throw new ConflictException('Could not issue a payment reference, please try again');
  }

  async createRequest(tenantId: string, userId: string, dto: CreateRequestDto) {
    const account = await this.prisma.paymentAccount.findFirst({ where: { id: dto.accountId, isActive: true } });
    if (!account) throw new NotFoundException('Payment account not found');
    const q = await this.quote(tenantId, dto);
    if (account.currency !== q.currency) {
      // The brief allows paying a different currency only with a stated reason; the account is shown, so make that explicit up front.
      this.logger.log(`request for ${q.currency} against a ${account.currency} account (tenant ${tenantId})`);
    }
    const reference = await this.newReference();
    try {
      const req = await this.prisma.paymentRequest.create({
        data: {
          tenantId, purpose: q.purpose, planCode: q.planCode, planVersionId: q.planVersionId, billingPeriod: q.billingPeriod, packCode: q.packCode,
          currency: q.currency, expectedAmount: q.expectedAmount, lineItems: q.lineItems as any, reference, accountId: account.id, createdByUserId: userId,
        },
      });
      await this.audit.log({ tenantId, userId, action: 'CREATE', entity: 'PaymentRequest', entityId: req.id, after: { purpose: q.purpose, expected: q.expectedAmount, currency: q.currency, reference } });
      return this.present(req);
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('You already have an open payment request for this. Finish or cancel it first.');
      throw e;
    }
  }

  async cancelRequest(tenantId: string, userId: string, id: string) {
    const r = await this.mine(tenantId, id);
    if (r.status !== 'AWAITING_PROOF') throw new BadRequestException('Only a request that is still waiting for proof can be cancelled');
    const res = await this.prisma.paymentRequest.updateMany({ where: { id, tenantId, status: 'AWAITING_PROOF' }, data: { status: 'CANCELLED' } });
    if (res.count !== 1) throw new ConflictException('This request has already changed');
    await this.audit.log({ tenantId, userId, action: 'CANCEL', entity: 'PaymentRequest', entityId: id });
    return { cancelled: true };
  }

  private async mine(tenantId: string, id: string) {
    const r = await this.prisma.paymentRequest.findFirst({ where: { id, tenantId }, include: { account: true, receipt: true, proof: { select: { id: true, mime: true, size: true, filename: true, createdAt: true } } } });
    if (!r) throw new NotFoundException('Payment request not found'); // another tenant's id looks exactly like a missing one
    return r;
  }

  private present(r: any) {
    const { createdByUserId: _c, reviewedByUserId: _r, planVersionId: _p, ...rest } = r;
    return rest;
  }

  async listRequests(tenantId: string) {
    const rows = await this.prisma.paymentRequest.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100, include: { account: { select: { label: true, bankName: true } }, receipt: { select: { number: true } }, proof: { select: { id: true } } } });
    return rows.map((r) => this.present(r));
  }

  async getRequest(tenantId: string, id: string) {
    return this.present(await this.mine(tenantId, id));
  }

  async uploadProof(tenantId: string, userId: string, id: string, file: { buffer: Buffer; originalname?: string; size?: number } | undefined, body: UploadProofDto) {
    if (!file?.buffer?.length) throw new BadRequestException('Attach a screenshot or PDF of the transfer');
    if (file.buffer.length > PROOF_MAX_BYTES) throw new BadRequestException('The file is larger than 5 MB');
    const kind = sniffProof(file.buffer);
    if (!kind) throw new BadRequestException('Unsupported file. Upload a PNG, JPG, WEBP or PDF.');

    const r = await this.mine(tenantId, id);
    if (r.status !== 'AWAITING_PROOF') throw new ConflictException('This request already has its proof. Start a new request if you need to change it.');

    const declaredAmount = body.declaredAmount != null ? money(cents(body.declaredAmount)) : null;
    const declaredCurrency = body.declaredCurrency ? body.declaredCurrency.toUpperCase() : null;
    const differs = (declaredAmount != null && declaredAmount !== money(cents(r.expectedAmount))) || (declaredCurrency != null && declaredCurrency !== r.currency);
    const note = body.note?.trim() || null;
    if (differs && (!note || note.length < 5)) throw new BadRequestException('You paid a different amount or currency than expected. Add a short reason so we can check it.');

    const { lifecycle, sub } = await this.lifecycleFor(tenantId);
    const settings = await this.settings();
    const needsProvisional = r.purpose === 'plan' && sub && lifecycle.periodEnd && (lifecycle.state === 'grace' || lifecycle.state === 'lapsed');

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.paymentRequest.updateMany({
        where: { id, tenantId, status: 'AWAITING_PROOF' },
        data: { status: 'PENDING', declaredAmount, declaredCurrency, customerNote: note },
      });
      if (moved.count !== 1) throw new ConflictException('This request already has its proof.');
      await tx.paymentProof.create({
        data: { requestId: id, mime: kind.mime, size: file.buffer.length, sha256: createHash('sha256').update(file.buffer).digest('hex'), filename: (file.originalname ?? 'proof').replace(/[^\w.\- ]/g, '_').slice(0, 120), data: new Uint8Array(file.buffer) },
      });
      if (needsProvisional) {
        // Once per period end: the unique (subscription, periodEnd) row is the guard, so a second upload cannot reopen it.
        await tx.$executeRaw`INSERT INTO "ProvisionalAccess" (id,"subscriptionId","periodEnd","until") VALUES (${'pa_' + randomBytes(10).toString('hex')}, ${sub!.id}, ${lifecycle.periodEnd}, ${new Date(Date.now() + (settings.provisionalHours ?? PROVISIONAL_DEFAULT_HOURS) * 3_600_000)}) ON CONFLICT ("subscriptionId","periodEnd") DO NOTHING`;
      }
    });
    await this.audit.log({ tenantId, userId, action: 'PROOF_UPLOADED', entity: 'PaymentRequest', entityId: id, after: { mime: kind.mime, size: file.buffer.length, declaredAmount, declaredCurrency } });

    const notify = process.env.BILLING_NOTIFY_EMAIL;
    if (notify) {
      await this.outbox.enqueue({ to: notify, subject: `Payment to check: ${r.reference}`, body: `A payment proof is waiting for review.\nReference: ${r.reference}\nExpected: ${r.currency} ${r.expectedAmount}\n`, tenantId, dedupeKey: `proof:${id}` }).catch(() => {});
    }
    return this.getRequest(tenantId, id);
  }

  async proofFor(tenantId: string, id: string) {
    const r = await this.mine(tenantId, id);
    const p = await this.prisma.paymentProof.findUnique({ where: { requestId: r.id } });
    if (!p) throw new NotFoundException('No proof uploaded');
    return p;
  }

  async receipt(tenantId: string, id: string) {
    const r = await this.mine(tenantId, id);
    if (r.status !== 'APPROVED' || !r.receipt) throw new NotFoundException('No receipt for this request yet');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, subdomain: true } });
    return this.receiptBody(r, r.receipt, tenant!);
  }

  receiptBody(r: any, receipt: { number: string; amount: any; currency: string; issuedAt: Date }, tenant: { name: string; subdomain: string }) {
    return {
      issuer: receiptIssuer(),
      number: receipt.number,
      issuedAt: receipt.issuedAt,
      customer: { name: tenant.name, subdomain: tenant.subdomain },
      reference: r.reference,
      description: r.purpose === 'plan' ? `${r.planCode} plan, ${r.billingPeriod}` : `AI credit pack ${r.packCode}`,
      period: r.periodStartAt && r.periodEndAt ? { from: r.periodStartAt, to: r.periodEndAt } : null,
      lineItems: r.lineItems,
      amount: money(cents(receipt.amount)),
      currency: receipt.currency,
      paymentMethod: 'Bank transfer',
    };
  }

  // ── Trial (new signups only) ─────────────────────────────────────────────────────────────────────
  /**
   * Starts a 30-day trial with 100 AI credits for a NEW public signup. Existing tenants are never touched: they have no
   * period end and therefore never lapse until an operator puts them on manual renewal. If the USD catalog has not been
   * seeded yet there is nothing to trial on, so the tenant simply behaves like a legacy tenant (no clock).
   */
  async startTrial(tenantId: string): Promise<boolean> {
    const version = await this.prisma.planVersion.findFirst({
      where: { isCurrent: true, offeredToNew: true, currency: 'USD', plan: { code: 'growth', isActive: true } },
    });
    if (!version) {
      this.logger.warn(`startTrial(${tenantId}): no offered USD 'growth' plan version; tenant gets no trial clock`);
      return false;
    }
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.create({ data: { tenantId, planVersionId: version.id, status: 'trialing', trialEndsAt, currentPeriodEnd: trialEndsAt, billingPeriod: 'monthly' } });
      await this.credits.setMonthly(tx, { tenantId, mc: creditsToMc(TRIAL_CREDITS), resetAt: trialEndsAt, key: `trial:${tenantId}`, kind: 'TRIAL' });
    });
    return true;
  }

  async requireBillingRole(role: string) {
    if (role !== 'COMPANY_ADMIN' && role !== 'HR_MANAGER') throw new ForbiddenException('Only company admins and HR managers can manage billing');
  }
}
