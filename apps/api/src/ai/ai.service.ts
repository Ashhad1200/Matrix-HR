import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CreditsService } from '../credits/credits.service';
import { AiSettingsService } from './ai-settings.service';
import { PROVIDERS } from './providers';
import { MAX_OUTPUT_TOKENS, estimateTokens, mcFor } from './pricing';

const SYSTEM_PROMPT = `You are Ask MatrixHR, an HR assistant for a Pakistani/GCC HR & payroll SaaS platform.
Answer concisely in plain English. Cover leave, attendance, onboarding, payroll (FBR tax, EOBI, PF), and labour law when relevant.
If employee context is provided, use it for personalized answers. If you lack data, say so and suggest what to check in the app.
Never invent employee-specific numbers not present in the context.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private entitlements: EntitlementsService,
    private credits: CreditsService,
    private settings: AiSettingsService,
  ) {}

  async askMatrixHR(tenantId: string, employeeId: string | undefined, question: string) {
    await this.entitlements.recordUsage(tenantId, 'ai.calls');

    const context = await this.buildContext(tenantId, employeeId);
    const geminiAnswer = await this.callModel(
      tenantId,
      `${context}\n\nUser question: ${question}`,
      SYSTEM_PROMPT,
    );

    if (geminiAnswer) {
      return { answer: geminiAnswer, source: 'ai' };
    }

    return this.fallbackAsk(tenantId, employeeId, question);
  }

  async rankCandidate(tenantId: string, jobDescription: string, resumeText: string) {
    const prompt = `Score this candidate resume against the job description from 0-100.
Reply as JSON only: {"score":number,"matchedKeywords":string[],"recommendation":"shortlist"|"review"|"reject","summary":string}

Job description:
${jobDescription}

Resume:
${resumeText}`;

    const raw = await this.callModel(tenantId, prompt, 'You are an ATS screening assistant. Output valid JSON only.');
    if (raw) {
      try {
        const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
        return {
          score: parsed.score ?? 0,
          matchedKeywords: parsed.matchedKeywords ?? [],
          recommendation: parsed.recommendation ?? 'review',
          summary: parsed.summary,
          source: 'ai',
        };
      } catch {
        this.logger.warn('rank-candidate returned non-JSON; using fallback');
      }
    }

    return { ...this.fallbackRank(jobDescription, resumeText), source: 'keyword' };
  }

  private async buildContext(tenantId: string, employeeId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, timezone: true, currency: true },
    });

    const lines = [
      `Company: ${tenant?.name ?? 'Unknown'}`,
      `Timezone: ${tenant?.timezone ?? 'Asia/Karachi'}`,
      `Currency: ${tenant?.currency ?? 'PKR'}`,
    ];

    if (employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
        include: { department: true, designation: true },
      });

      if (employee) {
        lines.push(
          `Employee: ${employee.firstName} ${employee.lastName}`,
          `Department: ${employee.department?.name ?? 'N/A'}`,
          `Role: ${employee.designation?.name ?? 'N/A'}`,
        );

        const balances = await this.prisma.leaveBalance.findMany({
          where: { tenantId, employeeId, year: new Date().getFullYear() },
          include: { policy: true },
        });

        if (balances.length) {
          lines.push('Leave balances:');
          for (const b of balances) {
            const remaining = Number(b.entitled) - Number(b.used) - Number(b.pending);
            lines.push(`  - ${b.policy.name}: ${remaining} days remaining`);
          }
        }
      }
    }

    const policies = await this.prisma.leavePolicy.findMany({
      where: { tenantId, isActive: true },
      take: 5,
    });
    if (policies.length) {
      lines.push('Leave policies:', ...policies.map((p) => `  - ${p.name}: ${p.daysPerYear} days/year`));
    }

    return lines.join('\n');
  }

  /**
   * One-shot completion through the configured provider, metered like the chat (reserve, then settle on real usage).
   * Returns null whenever AI is off, unconfigured, out of credits or failing, so callers use their built-in fallback.
   */
  private async callModel(tenantId: string, prompt: string, systemPrompt: string): Promise<string | null> {
    try {
      const row = await this.settings.row();
      const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { aiEnabled: true } });
      if (!row.enabled || !t?.aiEnabled) return null;
      const provider = row.provider as 'openai' | 'anthropic' | 'gemini';
      const key = await this.settings.apiKey(provider);
      if (!key) return null;
      const model = provider === 'openai' ? row.openaiModel : provider === 'anthropic' ? row.anthropicModel : row.geminiModel;
      await this.credits.ensureMonthly(tenantId);
      const res = await this.credits.reserve(tenantId, mcFor(model, estimateTokens(prompt + systemPrompt), MAX_OUTPUT_TOKENS), `ai_c_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      if (!res) return null;
      try {
        const out = await PROVIDERS[provider]({ apiKey: key, model, system: systemPrompt, messages: [{ role: 'user', content: prompt }], tools: [], maxTokens: MAX_OUTPUT_TOKENS });
        await this.credits.settle(res, out.inputTokens || out.outputTokens ? mcFor(model, out.inputTokens, out.outputTokens) : res.reservedMc);
        return out.text.trim() || null;
      } catch (err) {
        await this.credits.refund(res, 'provider call failed');
        this.logger.error(`AI provider call failed: ${(err as Error).message}`);
        return null;
      }
    } catch (err) {
      this.logger.error(`AI request failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async fallbackAsk(tenantId: string, employeeId: string | undefined, question: string) {
    const q = question.toLowerCase();

    if (q.includes('leave') && q.includes('balance')) {
      if (!employeeId) return { answer: 'Please log in as an employee to view your leave balance.', source: 'fallback' };
      const balances = await this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId, year: new Date().getFullYear() },
        include: { policy: true },
      });
      const lines = balances.map((b) => {
        const remaining = Number(b.entitled) - Number(b.used) - Number(b.pending);
        return `${b.policy.name}: ${remaining} days remaining`;
      });
      return { answer: `Your leave balances:\n${lines.join('\n')}`, source: 'leave_balance' };
    }

    if (q.includes('maternity')) {
      return {
        answer: 'Maternity leave in Pakistan is typically 16 weeks (8 weeks prenatal + 8 weeks postnatal) as per labour law. Check your company policy for specific entitlements.',
        source: 'policy',
      };
    }

    if (q.includes('attendance')) {
      return {
        answer: 'You can clock in/out via the web app, mobile app, or WhatsApp. Flexible 8-hour shifts are supported for software teams.',
        source: 'policy',
      };
    }

    return {
      answer: 'I can help with leave balances, attendance policies, and HR questions. Try asking "What is my leave balance?" or "How do I apply for maternity leave?"',
      source: 'general',
    };
  }

  private fallbackRank(jobDescription: string, resumeText: string) {
    const keywords = jobDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const resume = resumeText.toLowerCase();
    const matches = keywords.filter((k) => resume.includes(k));
    const score = Math.min(100, Math.round((matches.length / Math.max(keywords.length, 1)) * 100));
    return { score, matchedKeywords: matches.slice(0, 20), recommendation: score >= 60 ? 'shortlist' : 'review' };
  }
}
