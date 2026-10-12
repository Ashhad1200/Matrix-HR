import { formatMoney } from '@matrixhr/shared';

/** One formatter for every price on every screen: "PKR 18,999", "$69", "$0.50". */
export function money(amount: string | number | null | undefined, currency = 'USD') {
  const out = formatMoney(amount, currency);
  return out === '' ? '—' : out;
}

export const REQUEST_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  AWAITING_PROOF: { label: 'Waiting for proof', variant: 'info' },
  PENDING: { label: 'Under review', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

export function describeRequest(r: { purpose: string; planCode?: string | null; billingPeriod?: string | null; packCode?: string | null }) {
  const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  return r.purpose === 'plan' ? `${cap(r.planCode)} plan, ${r.billingPeriod === 'yearly' ? 'yearly' : 'monthly'}` : `${cap(r.packCode)} AI credit pack`;
}
