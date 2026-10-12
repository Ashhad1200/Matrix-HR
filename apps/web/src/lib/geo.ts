import { currencyForCountry, type Currency } from '@matrixhr/shared';

type H = { get(name: string): string | null };

const cache = new Map<string, { country: string | null; at: number }>();
const isPrivate = (ip: string) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|localhost)/i.test(ip);

/**
 * Visitor country for the marketing page, in order: Cloudflare's CF-IPCountry header, then (unless GEOIP_LOOKUP=off) a
 * short geo-IP lookup of the visitor's address. Returns null when neither knows; the browser time zone is the last resort
 * and is handled on the client. Never blocks the page for more than ~700 ms.
 */
export async function detectCountry(h: H): Promise<string | null> {
  const cf = (h.get('cf-ipcountry') || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(cf) && cf !== 'XX' && cf !== 'T1') return cf;
  if ((process.env.GEOIP_LOOKUP || '').toLowerCase() === 'off') return null;
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  if (!ip || isPrivate(ip)) return null;
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.country;
  try {
    const url = (process.env.GEOIP_URL || 'https://ipapi.co/{ip}/country/').replace('{ip}', encodeURIComponent(ip));
    const res = await fetch(url, { signal: AbortSignal.timeout(700), cache: 'no-store' });
    const text = (await res.text()).trim().toUpperCase();
    const country = res.ok && /^[A-Z]{2}$/.test(text) ? text : null;
    if (cache.size > 2000) cache.clear();
    cache.set(ip, { country, at: Date.now() });
    return country;
  } catch {
    return null;
  }
}

export const detectCurrency = async (h: H): Promise<Currency | null> => {
  const c = await detectCountry(h);
  return c ? currencyForCountry(c) : null;
};
