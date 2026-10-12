/** Formats a decimal string/number in the given currency, always two decimals for money that must reconcile with a bank statement. */
export function money(amount: string | number | null | undefined, currency = 'USD') {
  if (amount == null || amount === '') return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
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
