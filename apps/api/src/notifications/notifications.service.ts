import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel } from '@matrixhr/database';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    tenantId: string,
    userId: string,
    title: string,
    body: string,
    channel: NotificationChannel = 'IN_APP',
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.notification.create({
      data: { tenantId, userId, title, body, channel, metadata: metadata as any },
    });
  }

  async findByUser(tenantId: string, userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { tenantId, userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }
}
