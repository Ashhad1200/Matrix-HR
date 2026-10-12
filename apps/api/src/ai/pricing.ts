import { BadRequestException } from '@nestjs/common';
import { costUsdToMc } from '../credits/credits.service';

/** Provider list prices in USD per 1M tokens. Customers pay this x 4 (see CreditsService). A model that is not listed is refused, never billed at a guess. */
export const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
};

/** An attached image counts as this many input tokens. */
export const IMAGE_TOKENS = 2000;
export const MAX_OUTPUT_TOKENS = 1024;

export function priceFor(model: string) {
  const p = MODEL_PRICES[model];
  if (!p) throw new BadRequestException(`The model "${model}" has no price configured, so it cannot be used.`);
  return p;
}

export const usd = (model: string, inTok: number, outTok: number) => {
  const p = priceFor(model);
  return (inTok * p.in + outTok * p.out) / 1_000_000;
};

export const mcFor = (model: string, inTok: number, outTok: number) => costUsdToMc(usd(model, inTok, outTok));

/** Rough token estimate used only to size the reservation; the real usage reported by the provider settles it. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.5);
