import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnpsSurveyDto, UpdateEnpsSurveyDto, EnpsRespondDto } from './dto';

@Injectable()
export class EnpsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.enpsSurvey.findMany({
      where: { tenantId },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const survey = await this.prisma.enpsSurvey.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { responses: true } } },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    return survey;
  }

  async create(tenantId: string, dto: CreateEnpsSurveyDto) {
    return this.prisma.enpsSurvey.create({
      data: {
        tenantId,
        title: dto.title,
        question: dto.question,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateEnpsSurveyDto) {
    await this.findOne(tenantId, id);
    return this.prisma.enpsSurvey.update({
      where: { id },
      data: {
        title: dto.title,
        question: dto.question,
        status: dto.status,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        ...(dto.status === 'active' ? { sentAt: new Date() } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.enpsSurvey.delete({ where: { id } });
  }

  async respond(surveyId: string, dto: EnpsRespondDto) {
    const survey = await this.prisma.enpsSurvey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.status !== 'active') throw new BadRequestException('Survey is not accepting responses');
    if (survey.closesAt && survey.closesAt < new Date()) {
      throw new BadRequestException('Survey has closed');
    }

    return this.prisma.enpsResponse.create({
      data: {
        surveyId,
        score: dto.score,
        comment: dto.comment,
      },
    });
  }
}
