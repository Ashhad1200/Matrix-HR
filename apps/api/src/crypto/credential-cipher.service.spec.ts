import { CredentialCipherService } from './credential-cipher.service';

describe('CredentialCipherService', () => {
  const svc = new CredentialCipherService();

  it('round-trips and never stores plaintext', () => {
    const enc = svc.encrypt('xoxb-super-token')!;
    expect(enc).not.toContain('xoxb-super-token');
    expect(svc.isEncrypted(enc)).toBe(true);
    expect(svc.decrypt(enc)).toBe('xoxb-super-token');
  });

  it('uses a fresh IV each time and does not double-encrypt', () => {
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
    const once = svc.encrypt('same')!;
    expect(svc.encrypt(once)).toBe(once);
  });

  it('passes legacy plaintext through on read and detects tampering', () => {
    expect(svc.decrypt('legacy-plaintext-token')).toBe('legacy-plaintext-token');
    const enc = svc.encrypt('abc')!;
    const tampered = enc.slice(0, -4) + 'AAAA';
    expect(() => svc.decrypt(tampered)).toThrow();
  });
});
