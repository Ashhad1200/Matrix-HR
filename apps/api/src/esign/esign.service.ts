import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEsignRequestDto } from './dto';

@Injectable()
export class EsignService {
  constructor(private prisma: PrismaService) {}

  async createRequest(tenantId: string, dto: CreateEsignRequestDto) {
    return this.prisma.esignRequest.create({
      data: {
        tenantId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        signerEmail: dto.signerEmail,
        documentUrl: dto.documentUrl,
        status: 'pending',
      },
    });
  }

  async sign(tenantId: string, id: string) {
    const request = await this.prisma.esignRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw new NotFoundException('E-sign request not found');

    return this.prisma.esignRequest.update({
      where: { id },
      data: {
        status: 'signed',
        signedAt: new Date(),
      },
    });
  }
}
