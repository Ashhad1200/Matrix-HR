import { base32Decode, base32Encode, generateSecret, timeStep, totpAt, verifyTotp } from './totp';

// RFC 6238 appendix B: ASCII secret "12345678901234567890", SHA-1. The RFC lists 8-digit codes;
// the 6-digit code is the last six digits of the same value.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('matches the RFC test vector at t=%i', (seconds, expected) => {
    expect(totpAt(RFC_SECRET, seconds * 1000)).toBe(expected);
  });

  it('round-trips base32', () => {
    const s = generateSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(s).toHaveLength(32);
  });

  it('accepts one step of clock drift but not more', () => {
    const now = 1_700_000_000_000;
    const code = totpAt(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, { nowMs: now })).toBe(timeStep(now));
    expect(verifyTotp(RFC_SECRET, code, { nowMs: now + 30_000 })).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { nowMs: now + 120_000 })).toBeNull();
  });

  it('refuses a code whose step was already used (replay)', () => {
    const now = 1_700_000_000_000;
    const code = totpAt(RFC_SECRET, now);
    const step = verifyTotp(RFC_SECRET, code, { nowMs: now })!;
    expect(verifyTotp(RFC_SECRET, code, { nowMs: now, lastStep: step })).toBeNull();
  });

  it('rejects malformed codes', () => {
    expect(verifyTotp(RFC_SECRET, '12345')).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef')).toBeNull();
  });
});
