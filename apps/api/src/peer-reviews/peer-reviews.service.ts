import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePeerReviewDto, UpdatePeerReviewDto } from './dto';

@Injectable()
export class PeerReviewsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, cycleId?: string) {
    return this.prisma.peerReview360.findMany({
      where: { tenantId, ...(cycleId ? { cycleId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const review = await this.prisma.peerReview360.findFirst({
      where: { id, tenantId },
    });
    if (!review) throw new NotFoundException('Peer review not found');
    return review;
  }

  async create(tenantId: string, dto: CreatePeerReviewDto) {
    return this.prisma.peerReview360.create({
      data: {
        tenantId,
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        reviewerId: dto.reviewerId,
        relationship: dto.relationship || 'peer',
        isAnonymous: dto.isAnonymous ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePeerReviewDto) {
    await this.findOne(tenantId, id);
    return this.prisma.peerReview360.update({
      where: { id },
      data: {
        rating: dto.rating,
        feedback: dto.feedback,
        status: dto.status,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.peerReview360.delete({ where: { id } });
  }
}
