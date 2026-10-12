'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { money } from '@/components/billing/money';

/** Printable receipt. Deliberately outside the app shell so it prints as a clean A4 page. ?platform=1 is for the operator. */
function Receipt() {
  const { id } = useParams<{ id: string }>();
  const operator = useSearchParams().get('platform') === '1';
  const [r, setR] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { window.location.assign('/login'); return; }
    (operator ? api.platformBilling.receipt(id) : api.billing.receipt(id)).then(setR).catch((e) => setError(e.message || 'Receipt not found'));
  }, [id, operator]);

  if (error) return <main className="mx-auto max-w-xl p-10"><p role="alert">{error}</p></main>;
  if (!r) return <main className="mx-auto max-w-xl p-10"><p>Loading…</p></main>;

  return (
    <main className="mx-auto my-8 max-w-[210mm] bg-white p-10 text-[#0b1f19] shadow-lg print:my-0 print:shadow-none">
      <style>{`@media print { @page { size: A4; margin: 14mm; } body { background: #fff !important; } }`}</style>
      <div className="flex items-start justify-between gap-6 border-b-2 border-[#0b1f19] pb-5">
        <div>
          <p className="font-display text-2xl font-bold">{r.issuer.name}</p>
          <p className="mt-1 max-w-sm text-sm leading-snug">{r.issuer.legalForm}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold">Receipt</p>
          <p className="font-mono text-sm">{r.number}</p>
          <p className="mt-1 text-sm">{formatDate(r.issuedAt)}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div><dt className="text-[#4a5e57]">Received from</dt><dd className="mt-0.5 font-medium">{r.customer.name}</dd><dd className="text-[#4a5e57]">{r.customer.subdomain}</dd></div>
        <div><dt className="text-[#4a5e57]">Payment reference</dt><dd className="mt-0.5 font-mono font-medium">{r.reference}</dd><dd className="text-[#4a5e57]">{r.paymentMethod}</dd></div>
      </dl>

      <table className="mt-8 w-full text-sm">
        <thead><tr className="border-b border-[#0b1f19] text-left"><th className="py-2 font-semibold">Description</th><th className="py-2 text-right font-semibold">Amount ({r.currency})</th></tr></thead>
        <tbody>
          {(r.lineItems as any[]).map((l, i) => (<tr key={i} className="border-b border-[#d3ddd7]"><td className="py-2.5">{l.label}</td><td className="py-2.5 text-right tabular-nums">{Number(l.amount).toFixed(2)}</td></tr>))}
        </tbody>
        <tfoot><tr><td className="pt-4 text-base font-bold">Total received</td><td className="pt-4 text-right text-base font-bold tabular-nums">{money(r.amount, r.currency)}</td></tr></tfoot>
      </table>
      {r.period && <p className="mt-6 text-sm">Service period: {formatDate(r.period.from)} to {formatDate(r.period.to)}</p>}

      <footer className="mt-16 border-t border-[#d3ddd7] pt-4 text-xs leading-relaxed text-[#4a5e57]">
        <p>{r.issuer.name}, {r.issuer.legalForm}, NTN {r.issuer.ntn}.</p>
        <p>{r.issuer.address}. {r.issuer.email}</p>
      </footer>

      <button type="button" onClick={() => window.print()} className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0b1f19] px-5 py-2.5 text-sm font-semibold text-white print:hidden">
        <Printer className="h-4 w-4" aria-hidden="true" /> Print or save as PDF
      </button>
    </main>
  );
}

export default function ReceiptPage() {
  return <Suspense fallback={null}><Receipt /></Suspense>;
}
