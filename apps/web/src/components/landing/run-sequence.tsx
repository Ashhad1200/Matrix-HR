'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion, useScrollProgress } from './motion';
import { cn } from '@/lib/utils';

/** Status texts are the product's own (apps/web/src/app/(app)/payroll/page.tsx). */
const STEPS = [
  {
    status: 'Draft',
    title: 'The run builds itself',
    body: 'Approved attendance, unpaid leave, claims and loan instalments are already in. Recalculate as often as you like while it is a draft.',
    ui: 'Being prepared. Submit for review when ready.',
    action: 'Submit for review',
  },
  {
    status: 'Review',
    title: 'A second person checks it',
    body: 'Whoever prepared the run cannot approve it. MatrixHR enforces that, not a policy document.',
    ui: 'Awaiting approval from someone other than the preparer.',
    action: 'Approve',
  },
  {
    status: 'Approved',
    title: 'Lock it to pay',
    body: 'Locking generates every payslip as a PDF and archives it. From here the numbers stop moving.',
    ui: 'Approved — lock to generate and archive payslips.',
    action: 'Lock & generate payslips',
  },
  {
    status: 'Locked',
    title: 'Then the bank file',
    body: 'Export a generic bank file or a bank-specific format. Anyone with a bad IBAN is left out and listed, and the QuickBooks journal balances before you download it.',
    ui: 'Locked. Payslips are generated. Reopening requires a reason and admin approval.',
    action: 'Export bank file',
  },
];

const ROWS = [
  { name: 'Sara Ahmed', role: 'Senior Software Engineer', net: '218,283' },
  { name: 'Ali Khan', role: 'Engineering Manager', net: '301,560' },
  { name: 'Maryam Mirza', role: 'Product Designer', net: '164,960' },
  { name: 'Waqas Raza', role: 'QA Engineer', net: '118,420', flag: true },
];

const badge: Record<string, string> = {
  Draft: 'bg-[var(--mx-paper)] text-[var(--mx-ink-2)]',
  Review: 'bg-[#fdf1d8] text-[#7a4b00] dark:bg-[#3a2a08] dark:text-[#f4c864]',
  Approved: 'bg-[var(--mx-signal-soft)] text-[#13553c] dark:text-[var(--mx-signal)]',
  Locked: 'bg-[var(--mx-ink)] text-[var(--mx-paper)]',
};

export function RunSequence() {
  const [ref, progress] = useScrollProgress<HTMLDivElement>();
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setStill(mq.matches || prefersReducedMotion());
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const active = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length * 1.05));

  if (still) {
    // Phones and reduced motion: four states as a readable list, the final one showing the locked run.
    return (
      <div className="grid gap-12">
        <ol className="grid gap-8 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.status} className="border-t border-[var(--mx-rule)] pt-5">
              <span className={cn('inline-block rounded-[6px] px-2 py-1 text-xs font-semibold', badge[s.status])}>{s.status}</span>
              <h3 className="mt-3 font-display text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-[var(--mx-ink-2)]">{s.body}</p>
            </li>
          ))}
        </ol>
        <RunCard step={3} />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 grid h-dvh grid-cols-12 items-center gap-8">
        <ol className="col-span-5 grid gap-1" aria-label="Payroll run states">
          {STEPS.map((s, i) => (
            <li
              key={s.status}
              aria-current={i === active ? 'step' : undefined}
              className={cn(
                'relative border-l-2 py-3 pl-6 transition-[border-color,opacity] duration-300',
                i === active ? 'border-[var(--mx-ink)] opacity-100' : 'border-[var(--mx-rule)] opacity-45',
              )}
            >
              <p className="text-sm font-semibold text-[var(--mx-ink-2)]">{s.status}</p>
              <h3 className="font-display text-2xl font-bold tracking-tight">{s.title}</h3>
              <div className="mx-line" data-on={i === active}>
                <div>
                  <p className="max-w-[44ch] pt-2 text-[var(--mx-ink-2)]">{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="col-span-7">
          <RunCard step={active} />
        </div>
      </div>
    </div>
  );
}

function RunCard({ step }: { step: number }) {
  const s = STEPS[step];
  const locked = s.status === 'Locked';
  return (
    <div className="relative">
      <div className="mx-sheet overflow-hidden rounded-[4px] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight">Payroll run, September 2026</p>
            <p className="text-sm text-[var(--mx-ink-2)]">Acme Software, 30 employees</p>
          </div>
          <span key={s.status} className={cn('animate-scale-in rounded-[6px] px-2.5 py-1 text-xs font-bold', badge[s.status])}>
            {s.status.toUpperCase()}
          </span>
        </div>

        <p key={s.ui} className="mt-4 animate-fade-in rounded-[8px] bg-[var(--mx-paper)] px-3.5 py-2.5 text-sm">
          {s.ui}
        </p>

        <table className="mt-4 w-full text-[0.9375rem]">
          <caption className="sr-only">Net pay by employee, first four of thirty</caption>
          <thead>
            <tr className="border-b border-[var(--mx-rule)] text-left text-xs text-[var(--mx-ink-2)]">
              <th scope="col" className="py-2 font-medium">Employee</th>
              <th scope="col" className="py-2 text-right font-medium">Net pay (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name} className="border-b border-[var(--mx-rule)] last:border-0">
                <td className="py-3">
                  <span className="font-medium">{r.name}</span>
                  <span className="hidden text-[var(--mx-ink-2)] sm:inline">, {r.role}</span>
                  {locked && r.flag && (
                    <span className="mt-1 block animate-fade-in text-xs text-[var(--mx-debit)]">
                      Left out of the bank file: IBAN is not valid (check length and check digits)
                    </span>
                  )}
                </td>
                <td className="mx-num py-3 text-right align-top">{r.net}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mx-rule)] pt-4">
          <p className="text-xs text-[var(--mx-ink-2)]">
            {step === 1 ? 'The person who prepared this payroll run cannot also approve it.' : locked ? '29 included, 1 left out, journal balanced.' : 'Prepared by hr@acme.com'}
          </p>
          <span
            key={s.action}
            aria-hidden="true"
            className="animate-scale-in inline-flex h-9 items-center rounded-[8px] bg-[var(--mx-ink)] px-3.5 text-sm font-semibold text-[var(--mx-paper)]"
          >
            {s.action}
          </span>
        </div>
      </div>

      {/* The signature moment: the lock stamp lands on the run. */}
      <span
        aria-hidden="true"
        data-in={locked}
        className={cn(
          'mx-stamp pointer-events-none absolute left-[36%] top-[46%] px-2.5 py-0.5 text-2xl sm:left-auto sm:right-[22%] sm:top-[42%] sm:px-3 sm:py-1 sm:text-5xl',
          locked ? 'opacity-100' : 'opacity-0',
        )}
      >
        LOCKED
      </span>
    </div>
  );
}
