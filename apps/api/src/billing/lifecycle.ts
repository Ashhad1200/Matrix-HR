/**
 * Billing lifecycle, computed from dates. Nothing here is stored, so it cannot drift:
 *
 *   no period end ........ 'none'      the tenant has no billing clock and can never lapse (every pre-existing tenant)
 *   now <= end - 7d ...... 'ok'
 *   end - 7d < now <= end  'due_soon'
 *   end < now <= end+grace 'grace'     still fully usable, with a banner
 *   now > end + grace .... 'lapsed'    billing-only screen, unless a provisional window is open ('provisional')
 *
 * `blocked` is the only field access control should read.
 */
export type LifecycleState = 'none' | 'ok' | 'due_soon' | 'grace' | 'lapsed' | 'provisional';

export interface LifecycleInput {
  now: Date;
  /** Subscription.currentPeriodEnd. null/undefined = no billing clock. */
  periodEnd: Date | null | undefined;
  /** Subscription status; suspended/cancelled are operator decisions handled elsewhere, not by lapse. */
  graceDays: number;
  dueSoonDays?: number;
  /** An unrevoked provisional window for this exact period end, if any. */
  provisionalUntil?: Date | null;
}

export interface Lifecycle {
  state: LifecycleState;
  blocked: boolean;
  periodEnd: Date | null;
  graceEndsAt: Date | null;
  daysToEnd: number | null;
  provisionalUntil: Date | null;
}

const DAY = 86_400_000;

export function computeLifecycle(i: LifecycleInput): Lifecycle {
  if (!i.periodEnd) return { state: 'none', blocked: false, periodEnd: null, graceEndsAt: null, daysToEnd: null, provisionalUntil: null };
  const end = i.periodEnd.getTime();
  const now = i.now.getTime();
  const graceEnd = end + i.graceDays * DAY;
  const base = { periodEnd: i.periodEnd, graceEndsAt: new Date(graceEnd), daysToEnd: Math.ceil((end - now) / DAY) };
  const prov = i.provisionalUntil && i.provisionalUntil.getTime() > now ? i.provisionalUntil : null;

  if (now > graceEnd) {
    return prov
      ? { ...base, state: 'provisional', blocked: false, provisionalUntil: prov }
      : { ...base, state: 'lapsed', blocked: true, provisionalUntil: null };
  }
  if (now > end) return { ...base, state: 'grace', blocked: false, provisionalUntil: prov };
  if (end - now <= (i.dueSoonDays ?? 7) * DAY) return { ...base, state: 'due_soon', blocked: false, provisionalUntil: null };
  return { ...base, state: 'ok', blocked: false, provisionalUntil: null };
}

/** Paths a lapsed tenant may still reach: sign in/out, the billing screen itself, and health checks. */
export const LAPSED_ALLOWED_PATH = /^\/api\/v1\/(auth|billing|health)(\/|\?|$)/;

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  // 31 Jan + 1 month = 28/29 Feb, not 3 March.
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}
