import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_WEEKEND = [6, 0]; // Saturday, Sunday (0 = Sunday ... 6 = Saturday)

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The company's weekend days; falls back to Saturday + Sunday. */
export async function weekendDaysOf(prisma: PrismaService, tenantId: string): Promise<number[]> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { weekendDays: true } });
  return t?.weekendDays?.length ? t.weekendDays : t?.weekendDays ? [] : DEFAULT_WEEKEND;
}

/**
 * Counts the days a leave request takes off the balance: every day from start to end (inclusive) except the company's
 * weekend days and its public holidays (optional holidays are working days). Dates are calendar dates (UTC midnight).
 */
export async function countWorkingDays(prisma: PrismaService, tenantId: string, start: Date, end: Date): Promise<number> {
  if (end < start) throw new BadRequestException('End date must be after start date');
  if ((end.getTime() - start.getTime()) / 86_400_000 > 366) throw new BadRequestException('A leave request can span at most a year');
  const weekend = new Set(await weekendDaysOf(prisma, tenantId));
  const holidays = new Set(
    (await prisma.holiday.findMany({ where: { tenantId, isOptional: false, date: { gte: start, lte: end } }, select: { date: true } })).map((h) => day(h.date)),
  );
  let n = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    if (weekend.has(d.getUTCDay()) || holidays.has(day(d))) continue;
    n++;
  }
  return n;
}
