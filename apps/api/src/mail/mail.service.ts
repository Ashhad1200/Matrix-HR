import { Global, Injectable, Logger, Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export type Mail = { to: string; subject: string; text: string };

/** SMTP settings from env: SMTP_URL, or SMTP_HOST/PORT/USER/PASS (port 465 uses implicit TLS). */
export function buildTransport(env: NodeJS.ProcessEnv = process.env) {
  if (env.SMTP_URL) return nodemailer.createTransport(env.SMTP_URL);
  if (!env.SMTP_HOST) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
  });
}

export const mailFrom = (env: NodeJS.ProcessEnv = process.env) => env.SMTP_FROM || env.MAIL_FROM || 'MatrixHR <no-reply@matrixhr.local>';

/**
 * Transactional email. Without SMTP configured, dev keeps messages in an in-memory outbox (GET /dev/outbox);
 * production logs that email is unconfigured and never prints message bodies, because they can contain
 * single-use links. Missing SMTP never throws out of `send`, so it can never break the flow that triggered it.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter = buildTransport();
  readonly outbox: (Mail & { at: string })[] = [];

  get configured() {
    return !!this.transporter;
  }

  /** Fire-and-forget delivery used by flows that must not fail on mail (password reset). */
  async send(mail: Mail) {
    if (this.transporter) {
      await this.transporter.sendMail({ from: mailFrom(), replyTo: process.env.SMTP_REPLY_TO || undefined, ...mail });
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(`SMTP is not configured — email "${mail.subject}" was NOT delivered`);
      return;
    }
    this.devKeep(mail);
  }

  /** Delivery for the retrying outbox: throws on failure (and when SMTP is missing in production) so it is retried. */
  async deliver(mail: Mail): Promise<void> {
    if (this.transporter) {
      await this.transporter.sendMail({ from: mailFrom(), replyTo: process.env.SMTP_REPLY_TO || undefined, ...mail });
      return;
    }
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    this.devKeep(mail);
  }

  private devKeep(mail: Mail) {
    this.outbox.unshift({ ...mail, at: new Date().toISOString() });
    this.outbox.length = Math.min(this.outbox.length, 50);
    this.logger.warn(`[dev mail] "${mail.subject}" -> ${mail.to} (see GET /dev/outbox)`);
  }
}

const MAX_ATTEMPTS = 8;
/** 1m, 2m, 4m ... capped at 6h. */
export const backoffMs = (attempts: number) => Math.min(60_000 * 2 ** Math.max(attempts - 1, 0), 6 * 3_600_000);

/**
 * Durable outbound mail. Rows are written in the same request as whatever caused them (an approval, a reminder),
 * and a worker sends them with retry and backoff. A mail outage or missing SMTP config therefore only delays
 * email; it never blocks or fails a payment action. Rows are claimed with a short lease (nextAttemptAt) using
 * FOR UPDATE SKIP LOCKED, so several API replicas can run the worker without double-sending.
 */
@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxService.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private mail: MailService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.BILLING_WORKER === 'off') return;
    this.timer = setInterval(() => this.drain().catch((e) => this.logger.error(`outbox drain failed: ${e.message}`)), 30_000);
    this.timer.unref?.();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Queue an email. `dedupeKey` makes it idempotent (a second enqueue with the same key is ignored). */
  async enqueue(m: { to: string; subject: string; body: string; tenantId?: string; dedupeKey?: string }, db: Pick<PrismaService, 'emailOutbox'> = this.prisma) {
    try {
      await db.emailOutbox.create({ data: { toAddress: m.to, subject: m.subject, body: m.body, tenantId: m.tenantId, dedupeKey: m.dedupeKey } });
    } catch (e: any) {
      if (e?.code === 'P2002' && m.dedupeKey) return; // already queued
      throw e;
    }
  }

  async drain(limit = 20) {
    const claimed = await this.prisma.$queryRawUnsafe<{ id: string; toAddress: string; subject: string; body: string; attempts: number }[]>(
      `UPDATE "EmailOutbox" SET "nextAttemptAt" = now() + interval '5 minutes'
        WHERE id IN (SELECT id FROM "EmailOutbox" WHERE status = 'PENDING' AND "nextAttemptAt" <= now() ORDER BY "createdAt" LIMIT ${Number(limit)} FOR UPDATE SKIP LOCKED)
        RETURNING id, "toAddress", subject, body, attempts`,
    );
    for (const row of claimed) {
      try {
        await this.mail.deliver({ to: row.toAddress, subject: row.subject, text: row.body });
        await this.prisma.emailOutbox.update({ where: { id: row.id }, data: { status: 'SENT', sentAt: new Date(), attempts: row.attempts + 1, lastError: null } });
      } catch (e: any) {
        // No SMTP configured yet is a setup state, not a delivery failure: wait without burning attempts.
        const unconfigured = !this.mail.configured && process.env.NODE_ENV === 'production';
        const attempts = unconfigured ? row.attempts : row.attempts + 1;
        const dead = attempts >= MAX_ATTEMPTS;
        await this.prisma.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: dead ? 'FAILED' : 'PENDING',
            attempts,
            lastError: String(e?.message ?? e).slice(0, 300),
            nextAttemptAt: new Date(Date.now() + (unconfigured ? 15 * 60_000 : backoffMs(attempts))),
          },
        });
      }
    }
    return claimed.length;
  }
}

@Global()
@Module({ providers: [MailService, EmailOutboxService], exports: [MailService, EmailOutboxService] })
export class MailModule {}
