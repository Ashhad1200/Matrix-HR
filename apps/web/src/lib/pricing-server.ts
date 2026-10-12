import { USD_PLAN_CATALOG, AI_CREDIT_PACKS, parseCurrencies, type Currency } from '@matrixhr/shared';

export interface PriceSet { monthly: number | null; yearly: number | null; overagePerEmployee: number | null }
export interface PricingPlan { code: string; name: string; maxEmployees: number | null; maxAdminUsers: number | null; aiCreditsMonthly: number; USD: PriceSet; PKR: PriceSet }
export interface PricingData {
  currencies: Currency[];
  plans: PricingPlan[];
  creditPacks: { code: string; name: string; credits: number; USD: number | null; PKR: number | null }[];
}

const fallback = (): PricingData => ({
  currencies: parseCurrencies(process.env.WL_CURRENCIES),
  plans: USD_PLAN_CATALOG.map((p) => ({
    code: p.code, name: p.name, maxEmployees: p.maxEmployees, maxAdminUsers: p.maxAdminUsers, aiCreditsMonthly: p.aiCreditsMonthly,
    USD: { monthly: p.monthly, yearly: p.yearly, overagePerEmployee: p.overagePerEmployee },
    PKR: { monthly: p.monthlyPkr, yearly: p.yearlyPkr, overagePerEmployee: p.overagePerEmployeePkr },
  })),
  creditPacks: AI_CREDIT_PACKS.map((k) => ({ code: k.code, name: k.name, credits: k.credits, USD: k.price, PKR: k.pricePkr })),
});

/** The live price list from the API (so backoffice edits show on the site); the seed list if the API cannot be reached. */
export async function getPricing(): Promise<PricingData> {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${base}/pricing`, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    if (res.ok) {
      const d = (await res.json()) as PricingData;
      if (d.plans?.length) return d;
    }
  } catch { /* fall through */ }
  return fallback();
}
