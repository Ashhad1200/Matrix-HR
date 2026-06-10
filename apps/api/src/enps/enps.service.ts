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

  async getSummary(tenantId: string) {
    const survey = await this.prisma.enpsSurvey.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        responses: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!survey) {
      return { score: null, promoters: null, detractors: null, responses: [], themes: [], surveys: [] };
    }

    const scores = survey.responses.map((r) => r.score);
    const total = scores.length;
    const promoterCount = scores.filter((s) => s >= 9).length;
    const detractorCount = scores.filter((s) => s <= 6).length;
    const enps = total ? Math.round(((promoterCount - detractorCount) / total) * 100) : null;

    return {
      score: enps,
      promoters: total ? Math.round((promoterCount / total) * 100) : null,
      detractors: total ? Math.round((detractorCount / total) * 100) : null,
      responses: survey.responses,
      themes: this.groupThemes(survey.responses),
      surveys: await this.findAll(tenantId),
    };
  }

  /** Keyword-based clustering of open-text comments into actionable themes. */
  private groupThemes(responses: { score: number; comment: string | null }[]) {
    const THEME_KEYWORDS: Record<string, string[]> = {
      Compensation: ['salary', 'pay', 'compensation', 'raise', 'bonus', 'underpaid', 'increment'],
      'Work-life balance': ['balance', 'overtime', 'hours', 'workload', 'burnout', 'flexible', 'remote'],
      Management: ['manager', 'leadership', 'boss', 'micromanage', 'communication', 'transparency'],
      'Career growth': ['growth', 'promotion', 'career', 'learning', 'training', 'development', 'opportunity'],
      Culture: ['culture', 'team', 'environment', 'toxic', 'friendly', 'collaboration', 'respect'],
      'Tools & process': ['tools', 'process', 'software', 'equipment', 'bureaucracy', 'slow', 'system'],
    };

    const themes = new Map<string, { theme: string; count: number; avgScore: number; samples: string[] }>();

    for (const r of responses) {
      const comment = r.comment?.toLowerCase();
      if (!comment) continue;
      for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
        if (keywords.some((k) => comment.includes(k))) {
          const bucket = themes.get(theme) ?? { theme, count: 0, avgScore: 0, samples: [] };
          bucket.avgScore = (bucket.avgScore * bucket.count + r.score) / (bucket.count + 1);
          bucket.count += 1;
          if (bucket.samples.length < 3 && r.comment) bucket.samples.push(r.comment);
          themes.set(theme, bucket);
        }
      }
    }

    return [...themes.values()]
      .map((t) => ({ ...t, avgScore: Math.round(t.avgScore * 10) / 10 }))
      .sort((a, b) => b.count - a.count);
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
