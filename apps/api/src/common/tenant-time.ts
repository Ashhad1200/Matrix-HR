import type { PrismaService } from '../prisma/prisma.service';

/** "YYYY-MM-DD" for the current moment as seen in an IANA timezone (en-CA formats dates ISO-style). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * "Today" for a tenant. Comparing against UTC would mark a Karachi user's own date as "in the future"
 * for the first five hours of every local day (and Pacific users' as "yesterday" in the evening).
 */
export async function tenantToday(prisma: PrismaService, tenantId: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
  return todayIn(t?.timezone || 'Asia/Karachi');
}
