import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreboardingInviteDto } from './dto';

@Injectable()
export class PreboardingService {
  constructor(private prisma: PrismaService) {}

  async createInvite(tenantId: string, dto: CreatePreboardingInviteDto) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    return this.prisma.preboardingInvite.create({
      data: {
        tenantId,
        email: dto.email,
        applicationId: dto.applicationId,
        token,
        expiresAt,
        documents: dto.documents as any,
      },
    });
  }

  async getByToken(token: string) {
    const invite = await this.prisma.preboardingInvite.findUnique({
      where: { token },
      include: { tenant: { select: { id: true, name: true, logoUrl: true } } },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new NotFoundException('Invite has expired');
    if (invite.status !== 'pending') throw new NotFoundException('Invite is no longer valid');
    return invite;
  }
}
