import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialCipherService } from '../crypto/credential-cipher.service';
import { assertPublicHttpUrl } from './url-guard';

const MAX_ATTEMPTS = 6;
// Delay before attempt N+1 after attempt N fails: 1m, 5m, 30m, 2h, 6h.
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
const AUTO_DISABLE_AFTER = 15;
const LEASE_MS = 2 * 60_000;

export function signPayload(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export function webhookHealth(w: { isActive: boolean; consecutiveFailures: number }) {
  if (!w.isActive) return 'disabled';
  if (w.consecutiveFailures >= 5) return 'failing';
  if (w.consecutiveFailures > 0) return 'degraded';
  return 'healthy';
}

@Injectable()
export class WebhookDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private cipher: CredentialCipherService,
  ) {}

  // ponytail: in-process poller. Multiple API replicas are safe (attempts are claimed
  // atomically) but a real queue (BullMQ/Redis) is the upgrade if volume grows.
  onModuleInit() {
    if (process.env.WEBHOOK_WORKER === 'off') return;
    this.timer = setInterval(() => void this.processDue().catch((e) => this.logger.error(e)), 30_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(tenantId: string, event: string, payload: Record<string, unknown>) {
    const hooks = await this.prisma.webhook.findMany({
      where: { tenantId, isActive: true, events: { has: event } },
    });
    const ids: string[] = [];
    for (const hook of hooks) {
      const d = await this.prisma.webhookDelivery.create({
        data: { webhookId: hook.id, event, payload: payload as any, status: 'pending', nextAttemptAt: new Date() },
      });
      ids.push(d.id);
    }
    // Deliver in the background so callers (e.g. employee termination) never wait on a slow endpoint.
    void Promise.all(ids.map((id) => this.attempt(id))).catch((e) => this.logger.error(e));
    return ids;
  }

  async processDue(limit = 50) {
    const due = await this.prisma.webhookDelivery.findMany({
      where: { status: { in: ['pending', 'retrying'] }, nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    await Promise.all(due.map((d) => this.attempt(d.id)));
    return due.length;
  }

  /** Reset a failed/dead delivery and try again right away. */
  async redeliver(tenantId: string, deliveryId: string) {
    const d = await this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, webhook: { tenantId } },
    });
    if (!d) return null;
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null },
    });
    await this.attempt(deliveryId);
    return this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  }

  async sendTest(tenantId: string, webhookId: string) {
    const hook = await this.prisma.webhook.findFirst({ where: { id: webhookId, tenantId } });
    if (!hook) return null;
    const d = await this.prisma.webhookDelivery.create({
      data: {
        webhookId,
        event: 'webhook.test',
        payload: { message: 'This is a test delivery from MatrixHR.' },
        status: 'pending',
        nextAttemptAt: new Date(),
      },
    });
    await this.attempt(d.id, { ignoreInactive: true });
    return this.prisma.webhookDelivery.findUnique({ where: { id: d.id } });
  }

  async attempt(deliveryId: string, opts: { ignoreInactive?: boolean } = {}) {
    const now = new Date();
    // Claiming pushes nextAttemptAt out, so two workers can't send the same delivery.
    const claimed = await this.prisma.webhookDelivery.updateMany({
      where: {
        id: deliveryId,
        status: { in: ['pending', 'retrying'] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claimed.count === 0) return;

    const d = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } });
    if (!d) return;
    if (!d.webhook.isActive && !opts.ignoreInactive) {
      await this.prisma.webhookDelivery.update({
        where: { id: d.id },
        data: { status: 'failed', nextAttemptAt: null, lastError: 'Webhook is disabled' },
      });
      return;
    }

    const body = JSON.stringify({
      id: d.id,
      event: d.event,
      payload: d.payload,
      createdAt: d.createdAt.toISOString(),
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    let error: string | null = null;
    let response = '';
    try {
      await assertPublicHttpUrl(d.webhook.url);
      const secret = this.cipher.decrypt(d.webhook.secret) ?? '';
      const res = await fetch(d.webhook.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': d.id,
          'X-Webhook-Event': d.event,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Signature': signPayload(secret, timestamp, body),
        },
        body,
      });
      response = `${res.status} ${res.statusText}`;
      if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
    } catch (err: any) {
      error = err?.message || 'Delivery failed';
      response = error!;
    }

    if (!error) {
      await this.prisma.$transaction([
        this.prisma.webhookDelivery.update({
          where: { id: d.id },
          data: { status: 'delivered', attempts: d.attempts + 1, response, deliveredAt: new Date(), nextAttemptAt: null, lastError: null },
        }),
        this.prisma.webhook.update({
          where: { id: d.webhookId },
          data: { consecutiveFailures: 0, lastSuccessAt: new Date(), lastError: null },
        }),
      ]);
      return;
    }

    const attempts = d.attempts + 1;
    const dead = attempts >= MAX_ATTEMPTS;
    const failures = d.webhook.consecutiveFailures + 1;
    await this.prisma.$transaction([
      this.prisma.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: dead ? 'failed' : 'retrying',
          attempts,
          response,
          lastError: error,
          nextAttemptAt: dead ? null : new Date(Date.now() + BACKOFF_MS[attempts - 1]),
        },
      }),
      this.prisma.webhook.update({
        where: { id: d.webhookId },
        data: {
          consecutiveFailures: failures,
          lastFailureAt: new Date(),
          lastError: error,
          ...(failures >= AUTO_DISABLE_AFTER
            ? { isActive: false, disabledReason: `Disabled automatically after ${failures} consecutive failed deliveries` }
            : {}),
        },
      }),
    ]);
  }
}
