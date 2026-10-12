import { Injectable, Module } from '@nestjs/common';
import { Prisma } from '@matrixhr/database';
import { PrismaService } from '../prisma/prisma.service';
import { addMonths } from '../billing/lifecycle';

import { singleCompanyMode } from '../common/deployment';

export type Db = PrismaService | Prisma.TransactionClient;

/** 1 credit = $0.01 and customers pay provider cost x 4. Balances are integers in millicredits (1 credit = 1000). */
export const MARKUP = 4;
export const USD_PER_CREDIT = 0.01;
export const MC_PER_CREDIT = 1000;
export const costUsdToMc = (usd: number) => Math.max(1, Math.ceil((usd * MARKUP * MC_PER_CREDIT) / USD_PER_CREDIT - 1e-9));
export const creditsToMc = (credits: number) => Math.round(credits * MC_PER_CREDIT);
export const mcToCredits = (mc: number) => Math.round((mc / MC_PER_CREDIT) * 1000) / 1000;

export interface Reservation {
  callId: string;
  tenantId: string;
  reservedMc: number;
  monthlyPartMc: number;
  purchasedPartMc: number;
}

type Kind = 'GRANT' | 'PURCHASE' | 'MONTHLY' | 'TRIAL';

/**
 * Append-only credit ledger over a two-bucket balance (monthly credits that reset, purchased credits that never expire;
 * monthly is spent first). Concurrency rules:
 *  - every balance change is ONE atomic SQL statement, so parallel calls can never overspend;
 *  - every ledger row carries a unique idempotencyKey and is inserted with ON CONFLICT DO NOTHING; the balance moves
 *    only if the row was actually inserted, so a retried or double-submitted grant/settle/refund applies exactly once.
 */
@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

  private async ensureAccount(db: Db, tenantId: string) {
    await db.$executeRaw`INSERT INTO "AiCreditAccount" ("tenantId","updatedAt") VALUES (${tenantId}, now()) ON CONFLICT ("tenantId") DO NOTHING`;
  }

  /** Inserts the ledger row; resolves true only for the call that created it. */
  private async ledger(
    db: Db,
    r: { tenantId: string; kind: string; deltaMc: number; monthlyPartMc?: number; purchasedPartMc?: number; refId?: string; key: string; detail?: unknown; userId?: string },
  ): Promise<boolean> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      INSERT INTO "AiCreditLedger" (id,"tenantId",kind,"deltaMc","monthlyPartMc","purchasedPartMc","refId","idempotencyKey",detail,"createdByUserId")
      VALUES (${'cl_' + cryptoId()}, ${r.tenantId}, ${r.kind}, ${r.deltaMc}, ${r.monthlyPartMc ?? 0}, ${r.purchasedPartMc ?? 0}, ${r.refId ?? null}, ${r.key},
              ${r.detail === undefined ? null : JSON.stringify(r.detail)}::jsonb, ${r.userId ?? null})
      ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING id`;
    return rows.length === 1;
  }

  async balance(tenantId: string, db: Db = this.prisma) {
    const a = await db.aiCreditAccount.findUnique({ where: { tenantId } });
    const monthlyMc = a?.monthlyMc ?? 0;
    const purchasedMc = a?.purchasedMc ?? 0;
    return { monthlyMc, purchasedMc, totalMc: monthlyMc + purchasedMc, credits: mcToCredits(monthlyMc + purchasedMc), monthlyResetAt: a?.monthlyResetAt ?? null };
  }

  /** Add credits to a bucket exactly once per idempotencyKey. Returns false if this key was already applied. */
  async add(db: Db, o: { tenantId: string; mc: number; bucket: 'monthly' | 'purchased'; kind: Kind; key: string; refId?: string; detail?: unknown; userId?: string }): Promise<boolean> {
    if (!Number.isInteger(o.mc) || o.mc <= 0) throw new Error('credit amount must be a positive integer');
    await this.ensureAccount(db, o.tenantId);
    const first = await this.ledger(db, {
      tenantId: o.tenantId, kind: o.kind, deltaMc: o.mc,
      monthlyPartMc: o.bucket === 'monthly' ? o.mc : 0, purchasedPartMc: o.bucket === 'purchased' ? o.mc : 0,
      refId: o.refId, key: o.key, detail: o.detail, userId: o.userId,
    });
    if (!first) return false;
    if (o.bucket === 'purchased') await db.$executeRaw`UPDATE "AiCreditAccount" SET "purchasedMc" = "purchasedMc" + ${o.mc}, "updatedAt" = now() WHERE "tenantId" = ${o.tenantId}`;
    else await db.$executeRaw`UPDATE "AiCreditAccount" SET "monthlyMc" = "monthlyMc" + ${o.mc}, "updatedAt" = now() WHERE "tenantId" = ${o.tenantId}`;
    return true;
  }

  /** Replace the monthly bucket (monthly credits do not accumulate) and set when it next resets. */
  async setMonthly(db: Db, o: { tenantId: string; mc: number; resetAt: Date; key: string; kind: 'MONTHLY' | 'TRIAL'; refId?: string }): Promise<boolean> {
    await this.ensureAccount(db, o.tenantId);
    const first = await this.ledger(db, { tenantId: o.tenantId, kind: o.kind, deltaMc: o.mc, monthlyPartMc: o.mc, refId: o.refId, key: o.key });
    if (!first) return false;
    await db.$executeRaw`UPDATE "AiCreditAccount" SET "monthlyMc" = ${o.mc}, "monthlyResetAt" = ${o.resetAt}, "updatedAt" = now() WHERE "tenantId" = ${o.tenantId}`;
    return true;
  }

  /**
   * Lazily grant this month's plan credits to a tenant on a PAID plan whose period is still valid. Trials get their one-off
   * trial credits at signup and never plan credits; lapsed/expired tenants get none. Safe to call on every AI request.
   */
  async ensureMonthly(tenantId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId }, include: { planVersion: true } });
    const credits = sub?.planVersion.aiCreditsMonthly ?? 0;
    if (!sub || sub.status !== 'active' || credits <= 0) return;
    const now = new Date();
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) return;
    await this.ensureAccount(this.prisma, tenantId);
    const acct = await this.prisma.aiCreditAccount.findUnique({ where: { tenantId } });
    if (acct?.monthlyResetAt && acct.monthlyResetAt > now) return;
    const next = addMonths(now, 1);
    const stamp = (acct?.monthlyResetAt ?? new Date(0)).toISOString();
    // Conditional on the old reset time, so two concurrent requests grant once.
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.$executeRaw`UPDATE "AiCreditAccount" SET "monthlyMc" = ${creditsToMc(credits)}, "monthlyResetAt" = ${next}, "updatedAt" = now()
        WHERE "tenantId" = ${tenantId} AND ("monthlyResetAt" IS NULL OR "monthlyResetAt" <= now())`;
      if (moved === 1) await this.ledger(tx, { tenantId, kind: 'MONTHLY', deltaMc: creditsToMc(credits), monthlyPartMc: creditsToMc(credits), key: `monthly:${tenantId}:${stamp}` });
    });
  }

  /** Atomically take `mc` from the balance (monthly first). Returns null when the balance cannot cover it. */
  async reserve(tenantId: string, mc: number, callId: string): Promise<Reservation | null> {
    // Single-company install: the company pays its AI provider directly, so there is nothing to meter.
    if (singleCompanyMode()) return { callId, tenantId, reservedMc: 0, monthlyPartMc: 0, purchasedPartMc: 0 };
    return this.prisma.$transaction(async (tx) => {
      await this.ensureAccount(tx, tenantId);
      const rows = await tx.$queryRaw<{ mpart: number }[]>`
        WITH old AS (SELECT "monthlyMc" AS m, "purchasedMc" AS p FROM "AiCreditAccount" WHERE "tenantId" = ${tenantId} FOR UPDATE),
        upd AS (
          UPDATE "AiCreditAccount" a
             SET "monthlyMc" = a."monthlyMc" - LEAST(old.m, ${mc}),
                 "purchasedMc" = a."purchasedMc" - (${mc} - LEAST(old.m, ${mc})),
                 "updatedAt" = now()
            FROM old WHERE a."tenantId" = ${tenantId} AND old.m + old.p >= ${mc}
          RETURNING LEAST(old.m, ${mc}) AS mpart)
        SELECT mpart FROM upd`;
      if (rows.length === 0) return null;
      const monthlyPartMc = Number(rows[0].mpart);
      await this.ledger(tx, { tenantId, kind: 'RESERVE', deltaMc: -mc, monthlyPartMc: -monthlyPartMc, purchasedPartMc: -(mc - monthlyPartMc), refId: callId, key: `reserve:${callId}` });
      return { callId, tenantId, reservedMc: mc, monthlyPartMc, purchasedPartMc: mc - monthlyPartMc };
    });
  }

  private async giveBack(db: Db, r: Reservation, mc: number) {
    if (mc <= 0) return;
    const toMonthly = Math.min(mc, r.monthlyPartMc);
    await db.$executeRaw`UPDATE "AiCreditAccount" SET "monthlyMc" = "monthlyMc" + ${toMonthly}, "purchasedMc" = "purchasedMc" + ${mc - toMonthly}, "updatedAt" = now() WHERE "tenantId" = ${r.tenantId}`;
  }

  /** Charge the actual cost: return the unused part of the reservation (or take a little more, if available). A call is closed exactly once, by whichever of settle/refund comes first. */
  async settle(r: Reservation, actualMc: number): Promise<{ chargedMc: number }> {
    if (singleCompanyMode()) return { chargedMc: 0 };
    return this.prisma.$transaction(async (tx) => {
      const diff = r.reservedMc - actualMc;
      const first = await this.ledger(tx, { tenantId: r.tenantId, kind: 'SETTLE', deltaMc: diff, refId: r.callId, key: `close:${r.callId}`, detail: { reservedMc: r.reservedMc, actualMc } });
      if (!first) return { chargedMc: actualMc };
      if (diff > 0) await this.giveBack(tx, r, diff);
      else if (diff < 0) {
        const extra = -diff;
        await tx.$executeRaw`UPDATE "AiCreditAccount" SET "purchasedMc" = GREATEST("purchasedMc" - ${extra}, 0), "updatedAt" = now() WHERE "tenantId" = ${r.tenantId}`;
      }
      return { chargedMc: actualMc };
    });
  }

  /** The provider call failed: give the whole reservation back. A no-op if the call was already settled. */
  async refund(r: Reservation, reason: string): Promise<void> {
    if (singleCompanyMode()) return;
    await this.prisma.$transaction(async (tx) => {
      const first = await this.ledger(tx, { tenantId: r.tenantId, kind: 'REFUND', deltaMc: r.reservedMc, refId: r.callId, key: `close:${r.callId}`, detail: { reason: reason.slice(0, 200) } });
      if (first) await this.giveBack(tx, r, r.reservedMc);
    });
  }
}

function cryptoId() {
  return require('crypto').randomBytes(12).toString('hex');
}

@Module({ providers: [CreditsService], exports: [CreditsService] })
export class CreditsModule {}
