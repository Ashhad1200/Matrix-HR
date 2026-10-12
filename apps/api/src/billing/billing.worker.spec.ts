import { dueReminder } from './billing.worker';

const d = (s: string) => new Date(s);
const end = d('2026-10-31T00:00:00Z');
const days = [7, 1, 0];

describe('dueReminder', () => {
  it('sends nothing before the 7-day mark', () => expect(dueReminder(d('2026-10-20T00:00:00Z'), end, days)).toBeNull());
  it('sends the 7-day reminder inside the week, the 1-day inside the last day, and expiry after', () => {
    expect(dueReminder(d('2026-10-25T00:00:00Z'), end, days)).toBe('d7');
    expect(dueReminder(d('2026-10-30T12:00:00Z'), end, days)).toBe('d1');
    expect(dueReminder(d('2026-11-01T00:00:00Z'), end, days)).toBe('expired');
  });
  it('picks only the most urgent reminder, so a late first look does not backfill three emails', () => {
    expect(dueReminder(d('2026-10-30T12:00:00Z'), end, days)).toBe('d1');
  });
  it('is silent about long-dead periods', () => expect(dueReminder(d('2027-03-01T00:00:00Z'), end, days)).toBeNull());
  it('honours custom reminder days', () => expect(dueReminder(d('2026-10-20T00:00:00Z'), end, [14, 0])).toBe('d14'));
});
