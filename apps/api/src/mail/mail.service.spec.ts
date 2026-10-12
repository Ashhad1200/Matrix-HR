import { backoffMs, buildTransport, mailFrom } from './mail.service';

describe('mail config', () => {
  it('reads SMTP_HOST/PORT/USER/PASS and uses implicit TLS on 465', () => {
    const t: any = buildTransport({ SMTP_HOST: 'smtp.hostinger.com', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p' } as any);
    expect(t.options.host).toBe('smtp.hostinger.com');
    expect(t.options.secure).toBe(true);
    expect(t.options.auth).toEqual({ user: 'u', pass: 'p' });
  });
  it('is null (not a crash) when nothing is configured', () => {
    expect(buildTransport({} as any)).toBeNull();
  });
  it('prefers SMTP_FROM, falls back to MAIL_FROM', () => {
    expect(mailFrom({ SMTP_FROM: 'MatrixHR <noreply@treevoxa.com>', MAIL_FROM: 'x' } as any)).toBe('MatrixHR <noreply@treevoxa.com>');
    expect(mailFrom({ MAIL_FROM: 'legacy <l@x>' } as any)).toBe('legacy <l@x>');
  });
  it('backs off exponentially up to 6 hours', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([60_000, 120_000, 240_000]);
    expect(backoffMs(20)).toBe(6 * 3_600_000);
  });
});
