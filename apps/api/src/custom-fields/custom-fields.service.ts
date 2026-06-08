import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, entity?: string) {
    return this.prisma.customFieldDefinition.findMany({
      where: { tenantId, ...(entity ? { entity } : {}) },
      orderBy: [{ entity: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!field) throw new NotFoundException('Custom field not found');
    return field;
  }

  async create(tenantId: string, dto: CreateCustomFieldDto) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: {
        tenantId_entity_key: {
          tenantId,
          entity: dto.entity || 'Employee',
          key: dto.key,
        },
      },
    });
    if (existing) throw new ConflictException('Field key already exists for this entity');

    return this.prisma.customFieldDefinition.create({
      data: {
        tenantId,
        entity: dto.entity || 'Employee',
        key: dto.key,
        label: dto.label,
        fieldType: dto.fieldType,
        options: dto.options as any,
        required: dto.required ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomFieldDto) {
    await this.findOne(tenantId, id);
    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        fieldType: dto.fieldType,
        options: dto.options as any,
        required: dto.required,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.customFieldDefinition.delete({ where: { id } });
  }
}
