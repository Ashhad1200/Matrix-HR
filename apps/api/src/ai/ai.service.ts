import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

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
  ) {}

  async askMatrixHR(tenantId: string, employeeId: string | undefined, question: string) {
    const context = await this.buildContext(tenantId, employeeId);
    const geminiAnswer = await this.callGemini(
      `${context}\n\nUser question: ${question}`,
      SYSTEM_PROMPT,
    );

    if (geminiAnswer) {
      return { answer: geminiAnswer, source: 'gemini' };
    }

    return this.fallbackAsk(tenantId, employeeId, question);
  }

  async rankCandidate(jobDescription: string, resumeText: string) {
    const prompt = `Score this candidate resume against the job description from 0-100.
Reply as JSON only: {"score":number,"matchedKeywords":string[],"recommendation":"shortlist"|"review"|"reject","summary":string}

Job description:
${jobDescription}

Resume:
${resumeText}`;

    const raw = await this.callGemini(prompt, 'You are an ATS screening assistant. Output valid JSON only.');
    if (raw) {
      try {
        const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
        return {
          score: parsed.score ?? 0,
          matchedKeywords: parsed.matchedKeywords ?? [],
          recommendation: parsed.recommendation ?? 'review',
          summary: parsed.summary,
          source: 'gemini',
        };
      } catch {
        this.logger.warn('Gemini rank-candidate returned non-JSON; using fallback');
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

  private async callGemini(userPrompt: string, systemPrompt: string): Promise<string | null> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) return null;

    const model = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
        return null;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return typeof text === 'string' ? text.trim() : null;
    } catch (err) {
      this.logger.error(`Gemini request failed: ${err}`);
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
