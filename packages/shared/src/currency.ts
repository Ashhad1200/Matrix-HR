/**
 * Two billing currencies: PKR for Pakistan, USD for everyone else. Prices are set by hand per currency
 * (no FX conversion anywhere). One formatter for every screen, email and receipt.
 */
export const CURRENCIES = ['PKR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (v: unknown): v is Currency => v === 'PKR' || v === 'USD';

/** Pakistan pays in PKR; every other country, and an unknown one, in USD. */
export const currencyForCountry = (country?: string | null): Currency => ((country ?? '').trim().toUpperCase() === 'PK' ? 'PKR' : 'USD');

/** Browser time zone as a last-resort hint. */
export const currencyForTimeZone = (tz?: string | null): Currency => (tz === 'Asia/Karachi' ? 'PKR' : 'USD');

/**
 * "PKR 18,999" (never decimals) and "$69" / "$0.50" (decimals only when the amount has cents).
 * Takes the decimal amount (a string from the API, or a number).
 */
export function formatMoney(amount: string | number | null | undefined, currency: string = 'USD'): string {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  if (currency === 'PKR') return `PKR ${Math.round(n).toLocaleString('en-US')}`;
  const whole = Math.abs(n * 100 - Math.round(n * 100)) < 1e-9 && Math.round(n * 100) % 100 === 0;
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  const sign = n < 0 ? '-' : '';
  if (currency === 'USD') return `${sign}$${body}`;
  return `${sign}${currency} ${body}`;
}

/** Currencies a deployment offers: WL_CURRENCIES="PKR,USD" (default both), or one of them. */
export function parseCurrencies(raw?: string | null): Currency[] {
  const list = (raw ?? '').split(',').map((x) => x.trim().toUpperCase()).filter(isCurrency);
  const uniq = [...new Set(list)] as Currency[];
  return uniq.length ? uniq : [...CURRENCIES];
}

/** The tenant's currency, constrained to what the deployment offers. */
export function pickCurrency(wanted: Currency, offered: Currency[]): Currency {
  return offered.includes(wanted) ? wanted : offered[0];
}
