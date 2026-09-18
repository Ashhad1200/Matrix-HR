import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialCipherService } from '../crypto/credential-cipher.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { WebhookDeliveryService, webhookHealth } from './webhook-delivery.service';
import { assertPublicHttpUrl } from './url-guard';

type WebhookRow = { secret: string; isActive: boolean; consecutiveFailures: number; [key: string]: unknown };

/** The signing secret is shown once at creation; afterwards only its existence is reported. */
function toPublic<T extends WebhookRow>(w: T) {
  const { secret: _secret, ...rest } = w;
  return { ...rest, secretConfigured: true, health: webhookHealth(w) };
}

@Injectable()
export class WebhooksService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private cipher: CredentialCipherService,
    private delivery: WebhookDeliveryService,
  ) {}

  /** One-time, idempotent encryption of secrets written before encryption existed. */
  async onModuleInit() {
    const rows = await this.prisma.webhook.findMany({ select: { id: true, secret: true } });
    for (const r of rows.filter((x) => !this.cipher.isEncrypted(x.secret))) {
      await this.prisma.webhook.update({ where: { id: r.id }, data: { secret: this.cipher.encrypt(r.secret)! } });
    }
  }

  async findAll(tenantId: string) {
    const rows = await this.prisma.webhook.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toPublic);
  }

  private async getRow(tenantId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id, tenantId } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async findOne(tenantId: string, id: string) {
    return toPublic(await this.getRow(tenantId, id));
  }

  async create(tenantId: string, dto: CreateWebhookDto) {
    await assertPublicHttpUrl(dto.url);
    const secret = dto.secret || randomBytes(32).toString('hex');
    const row = await this.prisma.webhook.create({
      data: {
        tenantId,
        url: dto.url,
        events: dto.events,
        secret: this.cipher.encrypt(secret)!,
        isActive: dto.isActive ?? true,
      },
    });
    return { ...toPublic(row), secret };
  }

  async update(tenantId: string, id: string, dto: UpdateWebhookDto) {
    const existing = await this.getRow(tenantId, id);
    if (dto.url) await assertPublicHttpUrl(dto.url);
    const reEnabling = dto.isActive === true && !existing.isActive;
    const row = await this.prisma.webhook.update({
      where: { id },
      data: {
        url: dto.url,
        events: dto.events,
        secret: dto.secret ? this.cipher.encrypt(dto.secret)! : undefined,
        isActive: dto.isActive,
        ...(reEnabling ? { consecutiveFailures: 0, disabledReason: null } : {}),
      },
    });
    return toPublic(row);
  }

  async remove(tenantId: string, id: string) {
    await this.getRow(tenantId, id);
    await this.prisma.webhook.delete({ where: { id } });
    return { deleted: true };
  }

  async listDeliveries(tenantId: string, id: string, status?: string, limit = 50) {
    await this.getRow(tenantId, id);
    return this.prisma.webhookDelivery.findMany({
      where: { webhookId: id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async sendTest(tenantId: string, id: string) {
    await this.getRow(tenantId, id);
    return this.delivery.sendTest(tenantId, id);
  }

  async redeliver(tenantId: string, deliveryId: string) {
    const d = await this.delivery.redeliver(tenantId, deliveryId);
    if (!d) throw new NotFoundException('Delivery not found');
    return d;
  }

  async dispatch(tenantId: string, event: string, payload: Record<string, unknown>) {
    const ids = await this.delivery.enqueue(tenantId, event, payload);
    return { event, dispatched: ids.length, deliveryIds: ids };
  }
}
