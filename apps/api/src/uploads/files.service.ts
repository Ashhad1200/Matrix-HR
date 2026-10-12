import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { UploadsService, keyFromRef } from './uploads.service';

export interface FileToken { k: string; t: string; e: number; n?: string; d?: 'inline' | 'attachment' }

/**
 * Short-lived, tenant-bound download links. A link is minted only after the caller passed the normal permission check for the
 * record it belongs to (a payslip, an employee document); the token itself carries the object key, the tenant, an expiry and an
 * HMAC. The API streams the bytes, so storage never has to be reachable from the internet.
 */
@Injectable()
export class FilesService {
  constructor(private uploads: UploadsService) {}

  private key() {
    const base = process.env.FILE_SIGNING_KEY || process.env.JWT_SECRET || 'dev-secret-change-in-production';
    return createHmac('sha256', 'matrixhr-file-links-v1').update(base).digest();
  }
  private mac(body: string) { return createHmac('sha256', this.key()).update(body).digest('base64url'); }

  sign(t: Omit<FileToken, 'e'>, ttlSeconds = 300, now = Date.now()): string {
    const body = Buffer.from(JSON.stringify({ ...t, e: Math.floor(now / 1000) + ttlSeconds })).toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  verify(token: string, now = Date.now()): FileToken {
    const [body, sig] = (token ?? '').split('.');
    const bad = new NotFoundException('This link is invalid or has expired');
    if (!body || !sig) throw bad;
    const want = Buffer.from(this.mac(body));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) throw bad;
    let p: FileToken;
    try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw bad; }
    if (!p.k || !p.t || p.e * 1000 < now) throw bad;
    // The tenant is baked into every object key; refuse a token whose key belongs to someone else.
    if (!p.k.startsWith(`${p.t}/`)) throw bad;
    return p;
  }

  /** Signed link for a stored reference, but only if it really lives under this tenant's prefix. */
  linkFor(tenantId: string, ref: string, opts: { name?: string; disposition?: 'inline' | 'attachment' } = {}): { url: string; expiresInSeconds: number } {
    const key = keyFromRef(ref, this.uploads.bucketName, this.uploads.publicBase);
    if (!key || !key.startsWith(`${tenantId}/`)) throw new NotFoundException('File not found');
    const token = this.sign({ k: key, t: tenantId, n: opts.name, d: opts.disposition ?? 'attachment' });
    const base = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
    return { url: `${base}/api/v1/files/${token}`, expiresInSeconds: 300 };
  }
}
