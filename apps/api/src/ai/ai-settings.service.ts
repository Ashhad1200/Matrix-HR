import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialCipherService } from '../crypto/credential-cipher.service';
import { MODEL_PRICES } from './pricing';
import type { Provider } from './providers';

export const PROVIDER_LIST: Provider[] = ['openai', 'anthropic', 'gemini'];
export interface AiSettingsInput {
  enabled?: boolean; provider?: Provider;
  openaiModel?: string; anthropicModel?: string; geminiModel?: string;
  openaiKey?: string; anthropicKey?: string; geminiKey?: string; // write-only: never returned
  clearKeys?: Provider[];
}

/** Superadmin AI configuration. Keys are encrypted at rest, accepted write-only and never returned, logged or audited. */
@Injectable()
export class AiSettingsService {
  constructor(private prisma: PrismaService, private cipher: CredentialCipherService) {}

  /** Read fresh on every request so the master switch takes effect immediately. */
  async row() {
    return this.prisma.aiSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
  }

  async view() {
    const r = await this.row();
    const has = (v: string | null) => !!v;
    return {
      enabled: r.enabled, provider: r.provider, models: { openai: r.openaiModel, anthropic: r.anthropicModel, gemini: r.geminiModel },
      keys: { openai: has(r.openaiKeyEnc), anthropic: has(r.anthropicKeyEnc), gemini: has(r.geminiKeyEnc) || !!process.env.GEMINI_API_KEY },
      availableModels: Object.keys(MODEL_PRICES),
    };
  }

  async update(op: string, dto: AiSettingsInput) {
    const data: Record<string, unknown> = {};
    if (dto.enabled !== undefined) data.enabled = !!dto.enabled;
    if (dto.provider !== undefined) { if (!PROVIDER_LIST.includes(dto.provider)) throw new BadRequestException('Unknown provider'); data.provider = dto.provider; }
    for (const [k, f] of [['openaiModel', 'openai'], ['anthropicModel', 'anthropic'], ['geminiModel', 'gemini']] as const) {
      const m = dto[k];
      if (m !== undefined) { if (!MODEL_PRICES[m]) throw new BadRequestException(`"${m}" has no configured price; add it to the price table first`); data[k] = m; void f; }
    }
    for (const [k, col] of [['openaiKey', 'openaiKeyEnc'], ['anthropicKey', 'anthropicKeyEnc'], ['geminiKey', 'geminiKeyEnc']] as const) {
      const v = dto[k];
      if (v) { if (v.length < 8 || v.length > 400 || /\s/.test(v)) throw new BadRequestException('That does not look like an API key'); data[col] = this.cipher.encrypt(v); }
    }
    for (const p of dto.clearKeys ?? []) { if (PROVIDER_LIST.includes(p)) data[`${p}KeyEnc`] = null; }
    await this.row();
    await this.prisma.aiSettings.update({ where: { id: 'singleton' }, data });
    // The audit record names what changed, never a key value.
    await this.prisma.platformAuditLog.create({ data: { operatorUserId: op, action: 'EDIT_AI_SETTINGS', targetType: 'AiSettings', targetId: 'singleton', detail: { changed: Object.keys(data).map((k) => (k.endsWith('KeyEnc') ? `${k} (secret)` : k)), enabled: data.enabled, provider: data.provider } as any } });
    return this.view();
  }

  async apiKey(provider: Provider): Promise<string | null> {
    const r = await this.row();
    const enc = provider === 'openai' ? r.openaiKeyEnc : provider === 'anthropic' ? r.anthropicKeyEnc : r.geminiKeyEnc;
    return this.cipher.decrypt(enc) || (provider === 'gemini' ? process.env.GEMINI_API_KEY || null : null);
  }
}
