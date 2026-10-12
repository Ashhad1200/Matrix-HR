/**
 * Integration tests against a REAL Postgres (set RUN_DB_TESTS=1 and DATABASE_URL, schema applied by migrate deploy).
 * They cover what mocks cannot: row locks, idempotent concurrent approval, tenant isolation of every billing read, the lapse
 * gate, the credit ledger under parallel load, reminders and the outbox. Every row they create is removed in afterAll.
 */
import { randomUUID } from 'crypto';
import { ForbiddenException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailOutboxService, MailService } from '../mail/mail.service';
import { CreditsService, creditsToMc } from '../credits/credits.service';
import { BillingService } from './billing.service';
import { BillingAdminService } from './billing-admin.service';
import { BillingWorker } from './billing.worker';
import { JwtStrategy } from '../auth/jwt.strategy';
import { EmployeesService } from '../employees/employees.service';

const run = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const file = (buf = png, originalname = 'transfer.png') => ({ buffer: buf, originalname, size: buf.length });
const DAY = 86_400_000;

run('billing (database)', () => {
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const mail = new MailService();
  const outbox = new EmailOutboxService(prisma, mail);
  const credits = new CreditsService(prisma);
  const billing = new BillingService(prisma, audit, outbox, credits);
  const admin = new BillingAdminService(prisma, audit, outbox, credits, billing);
  const worker = new BillingWorker(prisma, outbox, billing);
  const sfx = randomUUID().slice(0, 8);

  const tenants: string[] = [];
  const accounts: string[] = [];
  let A: { id: string; user: string };
  let B: { id: string; user: string };
  let ops: string;
  let account: string;
  let planVersionIds: string[] = [];

  async function mkTenant(name: string, withEmployees = 0) {
    const t = await prisma.tenant.create({ data: { name: `${name}-${sfx}`, subdomain: `${name.toLowerCase()}-${sfx}` } });
    const u = await prisma.user.create({ data: { tenantId: t.id, email: `admin@${name.toLowerCase()}-${sfx}.test`, passwordHash: 'x', role: 'COMPANY_ADMIN' } });
    if (withEmployees) {
      await prisma.employee.createMany({ data: Array.from({ length: withEmployees }, (_, i) => ({ tenantId: t.id, employeeCode: `E${i}`, firstName: 'F', lastName: `L${i}`, email: `e${i}@${name.toLowerCase()}-${sfx}.test`, status: 'ACTIVE' as const })) });
    }
    tenants.push(t.id);
    return { id: t.id, user: u.id };
  }

  /** Subscribes a tenant to the USD plan `code` with the given period end (null = no clock). */
  async function subscribe(tenantId: string, code: string, periodEnd: Date | null, status = 'active') {
    const v = await prisma.planVersion.findFirstOrThrow({ where: { currency: 'USD', plan: { code } } });
    await prisma.subscription.upsert({
      where: { tenantId }, create: { tenantId, planVersionId: v.id, status, currentPeriodEnd: periodEnd }, update: { planVersionId: v.id, status, currentPeriodEnd: periodEnd },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
    // Minimal USD catalog for the test, created only if the dev seed has not already provided it.
    for (const c of [
      { code: 'starter', name: 'Starter', m: 25, y: 250, max: 25, credits: 150, over: null as number | null },
      { code: 'growth', name: 'Growth', m: 69, y: 690, max: 100, credits: 500, over: null },
      { code: 'business', name: 'Business', m: 149, y: 1490, max: 300, credits: 1500, over: 0.5 },
    ]) {
      const plan = await prisma.plan.upsert({ where: { code: c.code }, update: {}, create: { code: c.code, name: c.name } });
      const has = await prisma.planVersion.findFirst({ where: { planId: plan.id, currency: 'USD' } });
      if (!has) {
        const last = await prisma.planVersion.findFirst({ where: { planId: plan.id }, orderBy: { version: 'desc' } });
        const v = await prisma.planVersion.create({ data: { planId: plan.id, version: (last?.version ?? 0) + 1, isCurrent: true, offeredToNew: true, currency: 'USD', priceMonthly: c.m, priceYearly: c.y, aiCreditsMonthly: c.credits, maxEmployees: c.max, overagePerEmployee: c.over ?? undefined } });
        planVersionIds.push(v.id);
      }
    }
    await prisma.creditPack.upsert({ where: { code: 'small' }, update: {}, create: { code: 'small', name: 'Small', credits: 1000, price: 10 } });
    ops = (await prisma.user.create({ data: { tenantId: (await mkTenant('ops')).id, email: `op@ops-${sfx}.test`, passwordHash: 'x', role: 'SUPER_ADMIN' } })).id;
    const acct = await prisma.paymentAccount.create({ data: { label: `Test ${sfx}`, bankName: 'Test Bank', accountTitle: 'TREEVOXA', iban: 'PK00TEST0000000000000000', currency: 'USD' } });
    account = acct.id;
    accounts.push(acct.id);
    A = await mkTenant('alpha');
    B = await mkTenant('beta');
  }, 60_000);

  afterAll(async () => {
    await prisma.paymentRequest.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.aiCreditLedger.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.emailOutbox.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.paymentAccount.deleteMany({ where: { id: { in: accounts } } });
    await prisma.platformAuditLog.deleteMany({ where: { operatorUserId: ops } });
    await prisma.$disconnect();
  }, 60_000);

  const req = (t: { id: string; user: string }, dto: any = { purpose: 'plan', planCode: 'growth', period: 'monthly' }) => billing.createRequest(t.id, t.user, { ...dto, accountId: account });
  const reset = async (t: { id: string }) => {
    await prisma.paymentRequest.deleteMany({ where: { tenantId: t.id } });
    await prisma.provisionalAccess.deleteMany({ where: { subscription: { tenantId: t.id } } });
  };

  describe('pricing is computed on the server', () => {
    it('quotes the catalog price and ignores anything the client might send', async () => {
      const q = await billing.quote(A.id, { purpose: 'plan', planCode: 'growth', period: 'monthly', amount: 1 } as any);
      expect(q.expectedAmount).toBe('69.00');
      expect((await billing.quote(A.id, { purpose: 'plan', planCode: 'growth', period: 'yearly' })).expectedAmount).toBe('690.00');
    });
    it('adds the Business overage as its own line', async () => {
      const big = await mkTenant('big', 302);
      const q = await billing.quote(big.id, { purpose: 'plan', planCode: 'business', period: 'monthly' });
      expect(q.lineItems).toHaveLength(2);
      expect(q.lineItems[1].label).toMatch(/2 employees over 300/);
      expect(q.expectedAmount).toBe('150.00'); // 149 + 2 x 0.50
      expect((await billing.quote(big.id, { purpose: 'plan', planCode: 'business', period: 'yearly' })).expectedAmount).toBe('1502.00'); // 1490 + 2 x 0.50 x 12
    });
    it('quotes a PKR company in rupees from the PKR price list, overage included', async () => {
      const big = await mkTenant('bigpkr', 302);
      await prisma.tenant.update({ where: { id: big.id }, data: { billingCurrency: 'PKR' } });
      const q = await billing.quote(big.id, { purpose: 'plan', planCode: 'business', period: 'monthly' });
      expect(q.currency).toBe('PKR');
      expect(q.expectedAmount).toBe('40279.00'); // 39,999 + 2 x 140
      expect(q.lineItems[1].label).toMatch(/2 employees over 300 at PKR 140/);
      expect((await billing.quote(big.id, { purpose: 'plan', planCode: 'business', period: 'yearly' })).expectedAmount).toBe('403350.00'); // 399,990 + 2 x 140 x 12
      expect((await billing.quote(big.id, { purpose: 'credit_pack', packCode: 'large' })).expectedAmount).toBe('32999.00');
    });
    it('refuses a plan the tenant has outgrown instead of quoting a wrong price', async () => {
      const mid = await mkTenant('mid', 30);
      await expect(billing.quote(mid.id, { purpose: 'plan', planCode: 'starter', period: 'monthly' })).rejects.toThrow(/allows up to 25/);
    });
    it('does not offer legacy or unknown plans', async () => {
      await expect(billing.quote(A.id, { purpose: 'plan', planCode: 'enterprise', period: 'monthly' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requests and proofs', () => {
    beforeEach(() => reset(A));

    it('allows one open request per purpose, and the reference is unique and unambiguous', async () => {
      const r = await req(A);
      expect(r.reference).toMatch(/^MHR-[A-HJ-NP-Z2-9]{6}$/);
      expect(r.status).toBe('AWAITING_PROOF');
      await expect(req(A)).rejects.toBeInstanceOf(ConflictException);
      // a different purpose is independent
      const pack = await req(A, { purpose: 'credit_pack', packCode: 'small' });
      expect(pack.reference).not.toBe(r.reference);
      await billing.cancelRequest(A.id, A.user, pack.id);
      await billing.cancelRequest(A.id, A.user, r.id);
      expect((await req(A)).status).toBe('AWAITING_PROOF'); // cancelling frees the slot
    });

    it('checks the real bytes, the size, and requires a reason for a different amount', async () => {
      const r = await req(A);
      await expect(billing.uploadProof(A.id, A.user, r.id, file(Buffer.from('<script>alert(1)</script>'.padEnd(40)), 'x.png'), {})).rejects.toBeInstanceOf(BadRequestException);
      await expect(billing.uploadProof(A.id, A.user, r.id, file(Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)])), {})).rejects.toThrow(/larger than 5 MB/);
      await expect(billing.uploadProof(A.id, A.user, r.id, file(), { declaredAmount: 50 })).rejects.toThrow(/reason/);
      await expect(billing.uploadProof(A.id, A.user, r.id, file(), { declaredCurrency: 'PKR' })).rejects.toThrow(/reason/);
      const ok = await billing.uploadProof(A.id, A.user, r.id, file(), { declaredAmount: 50, note: 'Bank fees were deducted' });
      expect(ok.status).toBe('PENDING');
      expect(ok.proof?.mime).toBe('image/png');
    });

    it('accepts exactly one proof per request', async () => {
      const r = await req(A);
      await billing.uploadProof(A.id, A.user, r.id, file(), {});
      await expect(billing.uploadProof(A.id, A.user, r.id, file(), {})).rejects.toBeInstanceOf(ConflictException);
    });

    it("never reveals another tenant's request, proof or receipt (404, the same as a missing id)", async () => {
      const r = await req(A);
      await billing.uploadProof(A.id, A.user, r.id, file(), {});
      for (const call of [
        () => billing.getRequest(B.id, r.id), () => billing.proofFor(B.id, r.id), () => billing.receipt(B.id, r.id),
        () => billing.cancelRequest(B.id, B.user, r.id), () => billing.uploadProof(B.id, B.user, r.id, file(), {}),
      ]) await expect(call()).rejects.toBeInstanceOf(NotFoundException);
      expect(await billing.listRequests(B.id)).toEqual([]);
    });
  });

  describe('approve and reject', () => {
    beforeEach(() => reset(A));

    it('approves once, extends once, and issues one numbered receipt, even when two approvals race', async () => {
      const end = new Date(Date.now() + 10 * DAY);
      await subscribe(A.id, 'starter', end);
      const r = await req(A);
      await billing.uploadProof(A.id, A.user, r.id, file(), {});
      const results = await Promise.all([admin.approve(ops, r.id, {}), admin.approve(ops, r.id, {}), admin.approve(ops, r.id, {})]);
      expect(new Set(results.map((x) => x.receiptNumber)).size).toBe(1);
      expect(results[0].receiptNumber).toMatch(/^TVX-R-\d{4}-\d{6}$/);
      expect(await prisma.receipt.count({ where: { requestId: r.id } })).toBe(1);
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: A.id }, include: { planVersion: { include: { plan: true } } } });
      // extended from the existing future end by exactly one month, not three
      expect(sub.currentPeriodEnd!.getTime()).toBeGreaterThan(end.getTime() + 27 * DAY);
      expect(sub.currentPeriodEnd!.getTime()).toBeLessThan(end.getTime() + 32 * DAY);
      expect(sub.planVersion.plan.code).toBe('growth');
      expect(await prisma.platformAuditLog.count({ where: { targetId: r.id, action: 'APPROVE_PAYMENT' } })).toBe(1);
      // a later approve is a no-op
      const again = await admin.approve(ops, r.id, {});
      expect(again.receiptNumber).toBe(results[0].receiptNumber);
      expect((await prisma.subscription.findUniqueOrThrow({ where: { tenantId: A.id } })).currentPeriodEnd!.getTime()).toBe(sub.currentPeriodEnd!.getTime());
    });

    it('extends from now when the period has already lapsed', async () => {
      await subscribe(A.id, 'growth', new Date(Date.now() - 20 * DAY));
      const r = await req(A);
      await billing.uploadProof(A.id, A.user, r.id, file(), {});
      const before = Date.now();
      await admin.approve(ops, r.id, {});
      const end = (await prisma.subscription.findUniqueOrThrow({ where: { tenantId: A.id } })).currentPeriodEnd!.getTime();
      expect(end).toBeGreaterThan(before + 27 * DAY);
      expect(end).toBeLessThan(before + 32 * DAY);
    });

    it('needs a reason to approve a different amount or change the period', async () => {
      await subscribe(A.id, 'growth', new Date(Date.now() + 5 * DAY));
      const r = await req(A);
      await billing.uploadProof(A.id, A.user, r.id, file(), {});
      await expect(admin.approve(ops, r.id, { approvedAmount: 60 })).rejects.toThrow(/needs a reason/);
      await expect(admin.approve(ops, r.id, { periodEnd: new Date(Date.now() + 40 * DAY).toISOString() })).rejects.toThrow(/needs a reason/);
      const done = await admin.approve(ops, r.id, { approvedAmount: 60, reason: 'Customer paid net of bank charges' });
      expect(done.approvedAmount).toBe('60.00');
    });

    it('grants credit pack credits exactly once under a race', async () => {
      const before = (await credits.balance(A.id)).purchasedMc;
      const r = await req(A, { purpose: 'credit_pack', packCode: 'small' });
      await billing.uploadProof(A.id, A.user, r.id, file(), {});
      await Promise.all([admin.approve(ops, r.id, {}), admin.approve(ops, r.id, {})]);
      expect((await credits.balance(A.id)).purchasedMc - before).toBe(creditsToMc(1000));
    });

    it('rejection is final, needs a reason, and ends provisional access immediately', async () => {
      await subscribe(A.id, 'growth', new Date(Date.now() - 10 * DAY)); // past end + 3d grace = lapsed
      expect((await billing.state(A.id)).state).toBe('lapsed');
      const r = await req(A);
      await billing.uploadProof(A.id, A.user, r.id, file(), {});
      expect((await billing.state(A.id)).state).toBe('provisional');
      await expect(admin.reject(ops, r.id, { reason: 'no' })).rejects.toBeInstanceOf(BadRequestException);
      expect((await billing.state(A.id)).state).toBe('provisional'); // a refused rejection changes nothing
      await admin.reject(ops, r.id, { reason: 'Amount does not match the bank statement' });
      expect((await billing.state(A.id)).state).toBe('lapsed');
      await expect(admin.approve(ops, r.id, {})).rejects.toBeInstanceOf(BadRequestException);
      // a new request cannot reopen provisional access for the same period end
      const r2 = await req(A);
      await billing.uploadProof(A.id, A.user, r2.id, file(), {});
      expect((await billing.state(A.id)).state).toBe('lapsed');
    });
  });

  describe('the lapse gate (JwtStrategy)', () => {
    const strategy = new JwtStrategy(prisma);
    const call = (u: { id: string; tenantId: string; role: string }, path: string) =>
      (strategy as any).enforceBilling({ originalUrl: path }, u);

    it('never blocks a tenant with no period end, however old it is', async () => {
      const legacy = await mkTenant('legacy');
      await expect(call({ id: legacy.user, tenantId: legacy.id, role: 'COMPANY_ADMIN' }, '/api/v1/employees')).resolves.toBeUndefined();
      await subscribe(legacy.id, 'growth', null);
      await expect(call({ id: legacy.user, tenantId: legacy.id, role: 'COMPANY_ADMIN' }, '/api/v1/payroll/runs')).resolves.toBeUndefined();
      const s = await billing.state(legacy.id);
      expect(s).toMatchObject({ state: 'none', blocked: false, banner: null });
    });

    it('blocks a lapsed tenant everywhere except auth, billing and health, with a machine-readable code', async () => {
      const t = await mkTenant('lapsed');
      await subscribe(t.id, 'growth', new Date(Date.now() - 30 * DAY));
      const u = { id: t.user, tenantId: t.id, role: 'EMPLOYEE' };
      await expect(call(u, '/api/v1/employees')).rejects.toMatchObject({ response: { code: 'BILLING_LAPSED' } });
      await expect(call(u, '/api/v1/ai/chat')).rejects.toBeInstanceOf(ForbiddenException);
      for (const ok of ['/api/v1/auth/me', '/api/v1/billing/state', '/api/v1/health']) await expect(call(u, ok)).resolves.toBeUndefined();
      await expect(call({ ...u, role: 'SUPER_ADMIN' }, '/api/v1/employees')).resolves.toBeUndefined();
    });

    it('lets everyone in during the grace period', async () => {
      const t = await mkTenant('grace');
      await subscribe(t.id, 'growth', new Date(Date.now() - 1 * DAY));
      await expect(call({ id: t.user, tenantId: t.id, role: 'EMPLOYEE' }, '/api/v1/employees')).resolves.toBeUndefined();
      expect((await billing.state(t.id)).banner).toBe('grace');
    });
  });

  describe('trial and reminders', () => {
    it('starts a 30-day trial with 100 credits for a new signup only', async () => {
      const n = await mkTenant('newbie');
      expect(await billing.startTrial(n.id)).toBe(true);
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: n.id } });
      expect(sub.status).toBe('trialing');
      expect(Math.round((sub.trialEndsAt!.getTime() - Date.now()) / DAY)).toBe(30);
      expect(sub.currentPeriodEnd!.getTime()).toBe(sub.trialEndsAt!.getTime());
      expect((await credits.balance(n.id)).credits).toBe(100);
      // an existing tenant that never signed up through this path is untouched
      const old = await mkTenant('oldie');
      expect(await prisma.subscription.findUnique({ where: { tenantId: old.id } })).toBeNull();
      expect((await billing.state(old.id)).blocked).toBe(false);
    });

    it('does not give a trialing tenant free monthly plan credits after the trial ends', async () => {
      const n = await mkTenant('expired');
      await billing.startTrial(n.id);
      await prisma.subscription.update({ where: { tenantId: n.id }, data: { currentPeriodEnd: new Date(Date.now() - 1 * DAY), trialEndsAt: new Date(Date.now() - 1 * DAY) } });
      await prisma.aiCreditAccount.update({ where: { tenantId: n.id }, data: { monthlyMc: 0, monthlyResetAt: new Date(Date.now() - DAY) } });
      await credits.ensureMonthly(n.id);
      expect((await credits.balance(n.id)).credits).toBe(0);
    });

    it('queues each reminder once, even when the worker runs concurrently, and ignores tenants with no clock', async () => {
      const t = await mkTenant('remind');
      await subscribe(t.id, 'growth', new Date(Date.now() + 5 * DAY));
      const none = await mkTenant('quiet');
      await subscribe(none.id, 'growth', null);
      await Promise.all([worker.runReminders(), worker.runReminders(), worker.runReminders()]);
      const mine = await prisma.emailOutbox.findMany({ where: { tenantId: t.id } });
      expect(mine).toHaveLength(1);
      expect(mine[0].subject).toMatch(/ends on/);
      expect(await prisma.emailOutbox.count({ where: { tenantId: none.id } })).toBe(0);
      await worker.runReminders();
      expect(await prisma.emailOutbox.count({ where: { tenantId: t.id } })).toBe(1);
    });
  });

  describe('outbox', () => {
    it('sends queued mail, and a failing transport only delays it with backoff', async () => {
      const t = await mkTenant('mailer');
      await outbox.enqueue({ to: 'x@example.test', subject: 'ok', body: 'b', tenantId: t.id, dedupeKey: `d-${sfx}` });
      await outbox.enqueue({ to: 'x@example.test', subject: 'ok', body: 'b', tenantId: t.id, dedupeKey: `d-${sfx}` }); // duplicate ignored
      expect(await prisma.emailOutbox.count({ where: { tenantId: t.id } })).toBe(1);
      await outbox.drain(50);
      expect((await prisma.emailOutbox.findFirstOrThrow({ where: { tenantId: t.id } })).status).toBe('SENT');

      await outbox.enqueue({ to: 'y@example.test', subject: 'later', body: 'b', tenantId: t.id });
      const spy = jest.spyOn(mail, 'deliver').mockRejectedValue(new Error('smtp down'));
      await expect(outbox.drain(50)).resolves.toBeGreaterThanOrEqual(1); // never throws out of the worker
      spy.mockRestore();
      const failed = await prisma.emailOutbox.findFirstOrThrow({ where: { tenantId: t.id, subject: 'later' } });
      expect(failed).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'smtp down' });
      expect(failed.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('credits ledger', () => {
    it('never overspends under parallel reservations', async () => {
      const t = await mkTenant('race');
      await credits.add(prisma, { tenantId: t.id, mc: 10_000, bucket: 'purchased', kind: 'GRANT', key: `seed:${t.id}` });
      const attempts = await Promise.all(Array.from({ length: 25 }, (_, i) => credits.reserve(t.id, 1_000, `call-${t.id}-${i}`)));
      expect(attempts.filter(Boolean)).toHaveLength(10); // exactly what the balance covers
      expect((await credits.balance(t.id)).totalMc).toBe(0);
    });

    it('spends monthly credits before purchased ones, and a settled call returns the unused reservation exactly once', async () => {
      const t = await mkTenant('split');
      await credits.setMonthly(prisma, { tenantId: t.id, mc: 3_000, resetAt: new Date(Date.now() + 30 * DAY), key: `m:${t.id}`, kind: 'MONTHLY' });
      await credits.add(prisma, { tenantId: t.id, mc: 5_000, bucket: 'purchased', kind: 'PURCHASE', key: `p:${t.id}` });
      const r = (await credits.reserve(t.id, 4_000, `c-${t.id}`))!;
      expect(r).toMatchObject({ monthlyPartMc: 3_000, purchasedPartMc: 1_000 });
      await Promise.all([credits.settle(r, 1_500), credits.settle(r, 1_500), credits.settle(r, 1_500)]);
      await credits.refund(r, 'late failure'); // the call is already closed by the settle, so this must be a no-op
      // 8000 total, 4000 reserved, 1500 actually used => 6500 left, and only one closing ledger row
      expect((await credits.balance(t.id)).totalMc).toBe(6_500);
      expect(await prisma.aiCreditLedger.count({ where: { tenantId: t.id, idempotencyKey: `close:c-${t.id}` } })).toBe(1);
    });

    it('refund returns the whole reservation once', async () => {
      const t = await mkTenant('refund');
      await credits.add(prisma, { tenantId: t.id, mc: 2_000, bucket: 'purchased', kind: 'GRANT', key: `g:${t.id}` });
      const r = (await credits.reserve(t.id, 1_500, `rf-${t.id}`))!;
      await Promise.all([credits.refund(r, 'provider error'), credits.refund(r, 'provider error')]);
      expect((await credits.balance(t.id)).totalMc).toBe(2_000);
    });

    it('a double grant with the same idempotency key grants once', async () => {
      const t = await mkTenant('grant');
      const key = randomUUID();
      const [a, b] = await Promise.all([admin.grantCredits(ops, t.id, { credits: 50, reason: 'goodwill', idempotencyKey: key }), admin.grantCredits(ops, t.id, { credits: 50, reason: 'goodwill', idempotencyKey: key })]);
      expect([a.applied, b.applied].sort()).toEqual([false, true]);
      expect((await credits.balance(t.id)).credits).toBe(50);
      expect(await prisma.platformAuditLog.count({ where: { targetId: t.id, action: 'GRANT_CREDITS' } })).toBe(1);
    });
  });

  describe('employee cap', () => {
    it('blocks adding past Starter/Growth caps, never blocks Business or a legacy plan', async () => {
      const svc = new EmployeesService(prisma, audit, null as any, null as any, null as any, null as any);
      const assert = (id: string) => (svc as any).assertWithinPlanLimit(id);
      const s = await mkTenant('capped', 25);
      await subscribe(s.id, 'starter', null);
      await expect(assert(s.id)).rejects.toThrow(/up to 25/);
      const biz = await mkTenant('biz', 25);
      await subscribe(biz.id, 'business', null);
      await expect(assert(biz.id)).resolves.toBeUndefined();
      const noSub = await mkTenant('nosub', 500);
      await expect(assert(noSub.id)).resolves.toBeUndefined();
    });
  });
});
