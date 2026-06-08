import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto, CreateWorkflowInstanceDto } from './dto';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(tenantId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflowDefinition.create({
      data: {
        tenantId,
        name: dto.name,
        trigger: dto.trigger,
        steps: dto.steps as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWorkflowDto) {
    await this.findOne(tenantId, id);
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        trigger: dto.trigger,
        steps: dto.steps as any,
        isActive: dto.isActive,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.workflowDefinition.delete({ where: { id } });
  }

  async getInstances(tenantId: string, status?: string) {
    return this.prisma.workflowInstance.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { definition: { select: { id: true, name: true, trigger: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInstance(tenantId: string, dto: CreateWorkflowInstanceDto) {
    await this.findOne(tenantId, dto.definitionId);
    return this.prisma.workflowInstance.create({
      data: {
        tenantId,
        definitionId: dto.definitionId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        metadata: dto.metadata as any,
      },
      include: { definition: true },
    });
  }
}
