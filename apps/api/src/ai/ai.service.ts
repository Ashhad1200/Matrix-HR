import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  async askMatrixHR(tenantId: string, employeeId: string | undefined, question: string) {
    const q = question.toLowerCase();

    if (q.includes('leave') && q.includes('balance')) {
      if (!employeeId) return { answer: 'Please log in as an employee to view your leave balance.' };
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

  async rankCandidate(jobDescription: string, resumeText: string) {
    const keywords = jobDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const resume = resumeText.toLowerCase();
    const matches = keywords.filter((k) => resume.includes(k));
    const score = Math.min(100, Math.round((matches.length / Math.max(keywords.length, 1)) * 100));
    return { score, matchedKeywords: matches.slice(0, 20), recommendation: score >= 60 ? 'shortlist' : 'review' };
  }
}
