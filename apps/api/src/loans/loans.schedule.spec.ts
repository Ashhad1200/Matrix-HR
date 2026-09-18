import { addMonths, buildSchedule } from './loans.schedule';

describe('loan schedule', () => {
  it('always sums to exactly the loan amount, with the remainder on the last instalment', () => {
    const s = buildSchedule(100000, 3, '2026-11');
    expect(s.map((r) => r.amount)).toEqual([33333.33, 33333.33, 33333.34]);
    expect(Math.round(s.reduce((a, r) => a + r.amount, 0) * 100)).toBe(10_000_000);
  });

  it('rolls over year boundaries', () => {
    expect(buildSchedule(1200, 4, '2026-11').map((r) => r.period)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', 24)).toBe('2028-01');
  });

  it('handles a single-instalment advance and awkward cents', () => {
    expect(buildSchedule(5000.5, 1, '2026-10')).toEqual([{ period: '2026-10', amount: 5000.5 }]);
    const s = buildSchedule(1000.01, 7, '2026-01');
    expect(Math.round(s.reduce((a, r) => a + r.amount, 0) * 100)).toBe(100001);
  });
});
