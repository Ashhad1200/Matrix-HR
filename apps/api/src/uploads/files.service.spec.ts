import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { keyFromRef } from './uploads.service';

const uploads: any = { bucketName: 'matrixhr', publicBase: 'http://minio.example.com:9000' };
const svc = new FilesService(uploads);

describe('signed file links', () => {
  it('round-trips a token for the tenant that owns the key', () => {
    const t = svc.verify(svc.sign({ k: 't1/abc.pdf', t: 't1', n: 'payslip.pdf' }));
    expect(t).toMatchObject({ k: 't1/abc.pdf', t: 't1', n: 'payslip.pdf' });
  });
  it('rejects expired, tampered and malformed tokens', () => {
    const now = Date.now();
    expect(() => svc.verify(svc.sign({ k: 't1/a.pdf', t: 't1' }, 300, now - 301_000))).toThrow(NotFoundException);
    const good = svc.sign({ k: 't1/a.pdf', t: 't1' });
    const [body, sig] = good.split('.');
    const forged = Buffer.from(JSON.stringify({ k: 't2/a.pdf', t: 't2', e: Math.floor(now / 1000) + 999 })).toString('base64url');
    for (const bad of [`${forged}.${sig}`, `${body}.${sig.slice(0, -2)}xx`, 'nodot', '', `${body}.`]) expect(() => svc.verify(bad)).toThrow(NotFoundException);
  });
  it("refuses a token whose key is under another tenant's prefix", () => {
    expect(() => svc.verify(svc.sign({ k: 't2/secret.pdf', t: 't1' }))).toThrow(NotFoundException);
  });
  it("will not mint a link for another tenant's file, however the reference is written", () => {
    expect(() => svc.linkFor('t1', 's3:t2/x.pdf')).toThrow(NotFoundException);
    expect(() => svc.linkFor('t1', 'http://minio.example.com:9000/matrixhr/t2/x.pdf')).toThrow(NotFoundException);
    expect(() => svc.linkFor('t1', 'https://evil.example.com/anything.pdf')).toThrow(NotFoundException);
    expect(svc.linkFor('t1', 's3:t1/x.pdf').url).toMatch(/\/api\/v1\/files\//);
  });
  it('still resolves legacy public URLs that point into our bucket', () => {
    expect(svc.linkFor('t1', 'http://minio.example.com:9000/matrixhr/t1/old.pdf').url).toMatch(/files\//);
    expect(keyFromRef('http://localhost:9000/matrixhr/t1/a%20b.pdf', 'matrixhr')).toBe('t1/a b.pdf');
    expect(keyFromRef('not a url', 'matrixhr')).toBeNull();
  });
});
