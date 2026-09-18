/** Adds `n` months to a "YYYY-MM" period. */
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/**
 * Splits a loan into exact per-period instalments. Works in cents so the rows always add up to the amount:
 * every instalment is the rounded-down share, and the last one absorbs the remainder.
 */
export function buildSchedule(amount: number, installments: number, firstPeriod: string) {
  const totalCents = Math.round(amount * 100);
  const base = Math.floor(totalCents / installments);
  return Array.from({ length: installments }, (_, i) => ({
    period: addMonths(firstPeriod, i),
    amount: (i === installments - 1 ? totalCents - base * (installments - 1) : base) / 100,
  }));
}
