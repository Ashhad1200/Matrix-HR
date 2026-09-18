import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const PREFIX = 'enc:v1:';

/**
 * AES-256-GCM encryption for third-party credentials stored in the database.
 * Key comes from CREDENTIAL_KEY. Outside production it falls back to a key derived
 * from JWT_SECRET (with a warning) so local dev works; production refuses to boot
 * without an explicit key so tokens are never "encrypted" with a guessable one.
 */
@Injectable()
export class CredentialCipherService {
  private readonly logger = new Logger(CredentialCipherService.name);
  private readonly key: Buffer;

  constructor() {
    const configured = process.env.CREDENTIAL_KEY;
    if (!configured && process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIAL_KEY must be set in production to encrypt integration credentials');
    }
    if (!configured) {
      this.logger.warn('CREDENTIAL_KEY not set — deriving a dev key from JWT_SECRET. Set CREDENTIAL_KEY before production.');
    }
    const material = configured || process.env.JWT_SECRET || 'matrixhr-dev-only-key';
    this.key = scryptSync(material, 'matrixhr-credentials-v1', 32);
  }

  isEncrypted(value: string | null | undefined): boolean {
    return !!value && value.startsWith(PREFIX);
  }

  encrypt(plain: string | null | undefined): string | null {
    if (plain == null || plain === '') return null;
    if (this.isEncrypted(plain)) return plain;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  /** Legacy plaintext values (written before encryption existed) pass through unchanged. */
  decrypt(stored: string | null | undefined): string | null {
    if (stored == null) return null;
    if (!this.isEncrypted(stored)) return stored;
    const [iv, tag, ct] = stored.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }
}
