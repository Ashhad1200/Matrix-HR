import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormulaDto, UpdateFormulaDto } from './dto';

@Injectable()
export class FormulasService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.formulaDefinition.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const formula = await this.prisma.formulaDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!formula) throw new NotFoundException('Formula not found');
    return formula;
  }

  async create(tenantId: string, dto: CreateFormulaDto) {
    return this.prisma.formulaDefinition.create({
      data: { tenantId, ...dto },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateFormulaDto) {
    await this.findOne(tenantId, id);
    return this.prisma.formulaDefinition.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.formulaDefinition.delete({ where: { id } });
  }
}
