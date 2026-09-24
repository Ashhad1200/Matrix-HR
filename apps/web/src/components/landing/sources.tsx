'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useScrollProgress, prefersReducedMotion } from './motion';

type Fragment = {
  id: string;
  module: string;
  what: string;
  /** Scattered offset (as % of the stage) and rotation before the fragments settle into rows. */
  scatter: [number, number, number];
  body: ReactNode;
};

const FRAGMENTS: Fragment[] = [
  {
    id: 'punch',
    module: 'Time clock',
    what: 'ZKTeco terminals push punches straight in.',
    scatter: [-34, -120, -7],
    body: (
      <span className="font-mono text-[0.8125rem] tracking-tight">
        4471&nbsp;&nbsp;2026-09-03&nbsp;09:14:07&nbsp;&nbsp;0&nbsp;&nbsp;1
      </span>
    ),
  },
  {
    id: 'whatsapp',
    module: 'Time off',
    what: 'Leave is requested in the app and approved from WhatsApp with a one-time code.',
    scatter: [30, -150, 5],
    body: (
      <span>
        <span className="font-semibold">Sara:</span> Sir, kal chutti chahiye, ammi ki tabiyat theek nahi
      </span>
    ),
  },
  {
    id: 'email',
    module: 'Expenses',
    what: 'Claims are filed by category, approved, and paid in the next run.',
    scatter: [-22, 40, 4],
    body: (
      <span>
        <span className="font-semibold">Re: Re: Fw:</span> fuel receipts for August (3 attachments)
      </span>
    ),
  },
  {
    id: 'sheet',
    module: 'Loans',
    what: 'Instalments are recovered by payroll until the balance is zero.',
    scatter: [36, 10, -4],
    body: (
      <span>
        Loans_register_FINAL_v3.xlsx, <span className="font-semibold">row 38</span>
      </span>
    ),
  },
  {
    id: 'bank',
    module: 'Bank file',
    what: 'Invalid IBANs are left out of the file and listed, before anything reaches the bank.',
    scatter: [-8, 150, -3],
    body: (
      <span>
        <span className="font-semibold">Bulk upload rejected:</span> row 17, invalid IBAN
      </span>
    ),
  },
];

const clamp = (n: number) => Math.min(Math.max(n, 0), 1);

export function Sources() {
  const [ref, progress] = useScrollProgress<HTMLDivElement>();
  const [still, setStill] = useState(false);

  useEffect(() => {
    // Phones and reduced-motion visitors get the settled state with no pinning.
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setStill(mq.matches || prefersReducedMotion());
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // 0 → scattered, 1 → settled. Each fragment settles slightly after the previous one.
  const t = (i: number) => (still ? 1 : clamp((progress - 0.08 - i * 0.05) / 0.5));
  const labels = still ? 1 : clamp((progress - 0.62) / 0.2);

  return (
    <section
      id="before"
      aria-labelledby="before-title"
      className="relative bg-[var(--mx-ledger)] text-[var(--mx-ledger-ink)]"
    >
      <div aria-hidden="true" className="mx-tear absolute inset-x-0 top-0 -translate-y-full" />
      <div ref={ref} className="lg:h-[180vh]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:sticky lg:top-0 lg:h-dvh lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-8 lg:py-0">
          <div className="lg:col-span-4">
            <h2 id="before-title" className="mx-h2">
              Month-end starts in five different places.
            </h2>
            <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-[var(--mx-ledger-ink-2)]">
              A punch export, a WhatsApp thread, an email chain, a loan spreadsheet and a bank portal. Someone copies all of it
              into payroll by hand, every month.
            </p>
            <p
              className="mt-5 max-w-[42ch] text-lg leading-relaxed transition-opacity duration-300"
              style={{ opacity: still ? 1 : 0.25 + labels * 0.75 }}
            >
              In MatrixHR each one is a module that feeds the run, so nobody types a number twice.
            </p>
          </div>

          <ol className="relative lg:col-span-8 lg:pl-8">
            {FRAGMENTS.map((f, i) => {
              const k = 1 - t(i);
              const style = {
                transform: `translate(${f.scatter[0] * k}%, ${f.scatter[1] * k}%) rotate(${f.scatter[2] * k}deg)`,
              } as CSSProperties;
              return (
                <li key={f.id} className="grid items-center gap-x-6 gap-y-2 border-t border-[var(--mx-ledger-rule)] py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
                  <div
                    style={style}
                    className="w-fit max-w-full rounded-[4px] bg-[var(--mx-ledger-ink)] px-3.5 py-2.5 text-[0.9375rem] leading-snug text-[#0b1f19] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)] will-change-transform"
                  >
                    {f.body}
                  </div>
                  <div className="transition-[opacity,transform] duration-500" style={{ opacity: labels, transform: `translateX(${(1 - labels) * -12}px)` }}>
                    <p className="font-display text-lg font-bold tracking-tight text-white">{f.module}</p>
                    <p className="text-sm leading-snug text-[var(--mx-ledger-ink-2)]">{f.what}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
