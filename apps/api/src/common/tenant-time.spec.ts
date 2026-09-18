import { todayIn } from './tenant-time';

describe('todayIn', () => {
  // 20:00 UTC on 18 Sep is already 01:00 on 19 Sep in Karachi (UTC+5) and still the 18th in New York.
  const instant = new Date('2026-09-18T20:00:00Z');

  it('follows the timezone, not UTC', () => {
    expect(todayIn('UTC', instant)).toBe('2026-09-18');
    expect(todayIn('Asia/Karachi', instant)).toBe('2026-09-19');
    expect(todayIn('America/New_York', instant)).toBe('2026-09-18');
  });

  it('returns an ISO date usable for string comparison', () => {
    expect(todayIn('Asia/Karachi', instant)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
