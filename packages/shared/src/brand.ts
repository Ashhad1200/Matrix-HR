import { Currency, parseCurrencies } from './currency';

/**
 * White-label branding. One resolver used by the API, the web app and the mobile config.
 *
 * Off by default (the platform is "MatrixHR"). Setting WL_PRODUCT_NAME turns white-label on:
 * from then on every client-visible string uses the values below and the vendor name never appears.
 * The reseller's own client companies are still separate tenants on one server.
 */
export interface Brand {
  whiteLabel: boolean;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  supportEmail: string;
  emailFromName: string;
  websiteUrl: string | null;
  /** Billing currencies this deployment offers (WL_CURRENCIES). */
  currencies: Currency[];
}

export const DEFAULT_BRAND_NAME = 'MatrixHR';
export const DEFAULT_SUPPORT_EMAIL = 'support@treevoxa.com';

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const HEX = /^#[0-9a-fA-F]{6}$/;

export function resolveBrand(env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {})): Brand {
  const name = clean(env.WL_PRODUCT_NAME);
  if (!name) {
    return { whiteLabel: false, name: DEFAULT_BRAND_NAME, logoUrl: null, faviconUrl: null, primaryColor: null, supportEmail: DEFAULT_SUPPORT_EMAIL, emailFromName: DEFAULT_BRAND_NAME, websiteUrl: null, currencies: parseCurrencies(env.WL_CURRENCIES) };
  }
  const color = clean(env.WL_PRIMARY_COLOR);
  return {
    whiteLabel: true,
    name,
    logoUrl: clean(env.WL_LOGO_URL),
    faviconUrl: clean(env.WL_FAVICON_URL),
    primaryColor: color && HEX.test(color) ? color.toLowerCase() : null,
    supportEmail: clean(env.WL_SUPPORT_EMAIL) ?? '',
    emailFromName: clean(env.WL_EMAIL_FROM_NAME) ?? name,
    websiteUrl: clean(env.WL_WEBSITE_URL),
    currencies: parseCurrencies(env.WL_CURRENCIES),
  };
}

/** Short uppercase prefix for document numbers, from the product name (never the vendor's). */
export function brandPrefix(brand: Brand): string {
  if (!brand.whiteLabel) return 'TVX';
  const letters = brand.name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const p = letters.length > 1 ? letters.map((w) => w[0]).join('') : (letters[0] ?? 'DOC').slice(0, 3);
  return p.toUpperCase().slice(0, 4);
}

const mix = (c: number, t: number, a: number) => Math.round(c + (t - c) * a);
/** 50–950 palette from one colour: tints toward white above, shades toward black below (500 = the colour). */
export function brandPalette(hex: string): Record<string, string> {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const to = (t: number, a: number) => '#' + [mix(r, t, a), mix(g, t, a), mix(b, t, a)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const steps: [string, number, number][] = [
    ['50', 255, 0.94], ['100', 255, 0.86], ['200', 255, 0.72], ['300', 255, 0.52], ['400', 255, 0.28], ['500', 255, 0],
    ['600', 0, 0.14], ['700', 0, 0.3], ['800', 0, 0.46], ['900', 0, 0.6], ['950', 0, 0.74],
  ];
  return Object.fromEntries(steps.map(([k, t, a]) => [k, to(t, a)]));
}
