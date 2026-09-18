import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// RFC 4648 base32 + RFC 6238 TOTP (HMAC-SHA1, 30s step) — what Google Authenticator, Authy, 1Password etc. speak.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac('sha1', secret).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin =
    ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const timeStep = (nowMs: number, stepSeconds = 30) => Math.floor(nowMs / 1000 / stepSeconds);

export function totpAt(secretB32: string, nowMs: number, digits = 6): string {
  return hotp(base32Decode(secretB32), timeStep(nowMs), digits);
}

/**
 * Returns the matched time-step, or null. Accepts ±`window` steps of clock drift, and refuses any step
 * at or before `lastStep` so a code that was already used (or shoulder-surfed) cannot be replayed.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  opts: { nowMs?: number; window?: number; lastStep?: number | null } = {},
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const current = timeStep(opts.nowMs ?? Date.now());
  const window = opts.window ?? 1;
  for (let step = current - window; step <= current + window; step++) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    const expected = Buffer.from(hotp(secret, step, 6));
    const given = Buffer.from(code);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return step;
  }
  return null;
}

export function otpauthUrl(secretB32: string, account: string, issuer = 'MatrixHR'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
