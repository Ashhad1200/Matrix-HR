import { classify, minutesOfDayIn, inWorkWindow, newDeviceToken, sha256 } from './monitoring.util';

describe('monitoring utils', () => {
  it('classifies from app/domain name only, never content', () => {
    expect(classify('Visual Studio Code', null)).toBe('work');
    expect(classify('Slack', null)).toBe('communication');
    expect(classify(null, 'teams.microsoft.com')).toBe('communication');
    expect(classify('LockApp.exe', null)).toBe('idle');
    expect(classify(null, null)).toBe('other');
    expect(classify('', '')).toBe('other');
  });

  it('newDeviceToken is random, prefixed, and only its sha256 is meant to be stored', () => {
    const a = newDeviceToken(); const b = newDeviceToken();
    expect(a.token.startsWith('mon_')).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(sha256(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(a.hash).toHaveLength(64);
  });

  it('minutesOfDayIn respects the timezone', () => {
    const noonUtc = new Date('2026-06-01T12:00:00Z');
    expect(minutesOfDayIn('UTC', noonUtc)).toBe(12 * 60);
    expect(minutesOfDayIn('Asia/Karachi', noonUtc)).toBe(17 * 60); // UTC+5
  });

  it('inWorkWindow handles normal and overnight windows', () => {
    expect(inWorkWindow(600, 540, 1080)).toBe(true);   // 10:00 within 09:00-18:00
    expect(inWorkWindow(1140, 540, 1080)).toBe(false);  // 19:00 outside
    // overnight 22:00-06:00
    expect(inWorkWindow(23 * 60, 1320, 360)).toBe(true);
    expect(inWorkWindow(12 * 60, 1320, 360)).toBe(false);
    expect(inWorkWindow(500, 540, 540)).toBe(true);     // equal = always
  });
});
