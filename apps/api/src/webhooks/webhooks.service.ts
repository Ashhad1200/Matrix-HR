import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async create(tenantId: string, dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        tenantId,
        url: dto.url,
        events: dto.events,
        secret: dto.secret || randomBytes(32).toString('hex'),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWebhookDto) {
    await this.findOne(tenantId, id);
    return this.prisma.webhook.update({
      where: { id },
      data: {
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
        isActive: dto.isActive,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.webhook.delete({ where: { id } });
  }

  async dispatch(tenantId: string, event: string, payload: Record<string, unknown>) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId, isActive: true, events: { has: event } },
    });

    const deliveries: Awaited<ReturnType<typeof this.prisma.webhookDelivery.create>>[] = [];
    for (const webhook of webhooks) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: payload as any,
          status: 'pending',
        },
      });
      deliveries.push(delivery);

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Secret': webhook.secret,
          },
          body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
        });
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: response.ok ? 'delivered' : 'failed',
            response: `${response.status} ${response.statusText}`,
            attempts: 1,
          },
        });
      } catch (err: any) {
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            response: err.message,
            attempts: 1,
          },
        });
      }
    }

    return { event, dispatched: deliveries.length, deliveries };
  }
}
