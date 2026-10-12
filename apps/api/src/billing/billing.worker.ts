import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailOutboxService } from '../mail/mail.service';
import { BillingService } from './billing.service';

const DAY = 86_400_000;

/** Which reminder (if any) is due for a period end. Pure, so it can be tested. Highest crossed threshold wins; 0 means "on expiry". */
export function dueReminder(now: Date, periodEnd: Date, days: number[]): string | null {
  const t = now.getTime();
  const end = periodEnd.getTime();
  if (t > end + 14 * DAY) return null; // never email about long-dead periods
  const crossed = [...days].sort((a, b) => a - b).filter((d) => (d === 0 ? t >= end : t >= end - d * DAY && t < end));
  if (crossed.length === 0) return null;
  // The smallest crossed day is the most urgent (0 = expired, then 1, then 7).
  const d = crossed[0];
  return d === 0 ? 'expired' : `d${d}`;
}

/**
 * Sends the expiry reminders (default 7 days, 1 day, on expiry), each once per period end. The unique
 * (subscription, periodEnd, kind) row is inserted FIRST, so even with several API replicas an email is queued once.
 * Only tenants that have a period end are considered, so a pre-existing tenant with no billing clock is never emailed.
 */
@Injectable()
export class BillingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private outbox: EmailOutboxService, private billing: BillingService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.BILLING_WORKER === 'off') return;
    this.timer = setInterval(() => this.runReminders().catch((e) => this.logger.error(`reminders failed: ${e.message}`)), 15 * 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async runReminders(now = new Date()): Promise<number> {
    const settings = await this.billing.settings();
    const horizon = Math.max(...settings.reminderDaysList, 0);
    const subs = await this.prisma.subscription.findMany({
      where: { currentPeriodEnd: { not: null, lte: new Date(now.getTime() + horizon * DAY) }, status: { in: ['trialing', 'active', 'past_due'] }, tenant: { status: 'ACTIVE' } },
      include: { tenant: { select: { id: true, name: true } } },
    });
    let queued = 0;
    for (const s of subs) {
      const kind = dueReminder(now, s.currentPeriodEnd!, settings.reminderDaysList);
      if (!kind) continue;
      const inserted = await this.prisma.$executeRaw`INSERT INTO "BillingReminder" (id,"subscriptionId","periodEnd",kind) VALUES (${'br_' + randomBytes(10).toString('hex')}, ${s.id}, ${s.currentPeriodEnd}, ${kind}) ON CONFLICT ("subscriptionId","periodEnd",kind) DO NOTHING`;
      if (inserted !== 1) continue;
      const admins = await this.prisma.user.findMany({ where: { tenantId: s.tenantId, role: 'COMPANY_ADMIN', status: 'ACTIVE' }, select: { email: true } });
      const end = s.currentPeriodEnd!.toISOString().slice(0, 10);
      const subject = kind === 'expired' ? `Your MatrixHR plan has ended (${s.tenant.name})` : `Your MatrixHR plan ends on ${end}`;
      const body = kind === 'expired'
        ? `Your plan for ${s.tenant.name} ended on ${end}. You have a short grace period; after that the workspace shows only the billing page.\nPay by bank transfer from Billing in MatrixHR and upload your proof to keep everything running.\n`
        : `Your plan for ${s.tenant.name} ends on ${end}.\nRenew from Billing in MatrixHR: pick a plan, transfer the amount with your payment reference, and upload the proof.\n`;
      for (const a of admins) await this.outbox.enqueue({ to: a.email, subject, body, tenantId: s.tenantId, dedupeKey: `remind:${s.id}:${end}:${kind}:${a.email}` });
      queued++;
    }
    return queued;
  }
}
