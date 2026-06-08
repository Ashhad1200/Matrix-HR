import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDefinitionDto, UpdateReportDefinitionDto } from './dto';

@Injectable()
export class ReportsBuilderService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.reportDefinition.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const report = await this.prisma.reportDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!report) throw new NotFoundException('Report definition not found');
    return report;
  }

  async create(tenantId: string, userId: string, dto: CreateReportDefinitionDto) {
    return this.prisma.reportDefinition.create({
      data: {
        tenantId,
        name: dto.name,
        config: dto.config as any,
        createdBy: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateReportDefinitionDto) {
    await this.findOne(tenantId, id);
    return this.prisma.reportDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        config: dto.config as any,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.reportDefinition.delete({ where: { id } });
  }
}
