'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { calculatePayslip, formatPkr } from '@/lib/payslip';
import { RollingNumber } from './motion';
import { cn } from '@/lib/utils';

const BASE = 285_000;
const DAYS = 30; // September

type EventId = 'leave' | 'bonus' | 'claim' | 'loan';

const EVENTS: { id: EventId; title: string; detail: string; source: string; amount: number }[] = [
  { id: 'leave', title: '2 days of unpaid leave', detail: 'Approved by her manager', source: 'Time off', amount: 2 },
  { id: 'bonus', title: 'Q3 bonus', detail: 'Added by HR as a pay item', source: 'Payroll items', amount: 40_000 },
  { id: 'claim', title: 'Fuel claim', detail: 'Approved, waiting to be reimbursed', source: 'Expenses', amount: 6_850 },
  { id: 'loan', title: 'Laptop loan instalment', detail: '4 of 12', source: 'Loans', amount: 15_000 },
];

const fmt = (n: number) => formatPkr(n);
const neg = (n: number) => `−${formatPkr(n)}`;

function Line({
  label,
  source,
  value,
  debit,
  on = true,
  strong,
}: {
  label: string;
  source?: string;
  value: number;
  debit?: boolean;
  on?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="mx-line" data-on={on} aria-hidden={!on}>
      <div>
        <div className={cn('flex items-baseline py-[7px] text-[0.9375rem]', strong && 'font-semibold')}>
          <span className="shrink-0">{label}</span>
          {source && (
            <span className="ml-2 hidden shrink-0 rounded-[5px] bg-[var(--mx-paper)] px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none text-[var(--mx-ink-2)] sm:inline">
              {source}
            </span>
          )}
          <span className="mx-leader" aria-hidden="true" />
          <span className={cn('mx-num shrink-0', debit && 'text-[var(--mx-debit)]')}>
            <RollingNumber value={value} format={debit ? neg : fmt} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function PayslipDemo({ intro }: { intro?: ReactNode }) {
  const [on, setOn] = useState<Record<EventId, boolean>>({ leave: false, bonus: false, claim: true, loan: true });
  const toggle = (id: EventId) => setOn((s) => ({ ...s, [id]: !s[id] }));

  const p = useMemo(
    () =>
      calculatePayslip({
        base: BASE,
        daysInMonth: DAYS,
        unpaidDays: on.leave ? 2 : 0,
        taxableEarnings: on.bonus ? 40_000 : 0,
        reimbursements: on.claim ? 6_850 : 0,
        recoveries: on.loan ? 15_000 : 0,
      }),
    [on],
  );

  const deductions = p.tax + p.eobi + p.pf + p.recoveries;
  const total = p.net + deductions;
  const split = [
    { key: 'net', label: 'Take-home', value: p.net, color: 'var(--mx-signal)' },
    { key: 'tax', label: 'Income tax', value: p.tax, color: 'var(--mx-ink)' },
    { key: 'funds', label: 'EOBI and PF', value: p.eobi + p.pf, color: 'var(--mx-ink-2)' },
    { key: 'rec', label: 'Loan', value: p.recoveries, color: 'var(--mx-debit)' },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-7">
      {intro}
      {/* The month's events: each one is a real input to a MatrixHR payroll run. */}
      <fieldset className="mt-10 sm:mt-12">
        <legend className="text-sm font-semibold">Sara&rsquo;s September</legend>
        <p className="mt-1 text-sm text-[var(--mx-ink-2)]">Switch an event on or off and watch her payslip.</p>
        <ul className="mt-4 grid max-w-2xl grid-cols-2 gap-2">
          {EVENTS.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on[e.id]}
                onClick={() => toggle(e.id)}
                className={cn(
                  'group flex h-full w-full cursor-pointer items-start gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left sm:gap-3 sm:px-3 transition-[background-color,box-shadow] duration-150',
                  on[e.id]
                    ? 'bg-[var(--mx-sheet)] shadow-[0_0_0_1px_var(--mx-rule),0_6px_16px_-10px_rgb(8_37_28/0.35)]'
                    : 'shadow-[inset_0_0_0_1px_var(--mx-rule)] hover:bg-[var(--mx-sheet)]/60',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                    on[e.id] ? 'bg-[var(--mx-signal)]' : 'bg-[var(--mx-rule)]',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 [transition-timing-function:var(--mx-ease-stamp)]',
                      on[e.id] ? 'translate-x-[18px]' : 'translate-x-0.5',
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-medium leading-snug sm:text-[0.9375rem]">{e.title}</span>
                  <span className="hidden text-[0.8125rem] leading-snug text-[var(--mx-ink-2)] sm:block">
                    {e.id === 'leave' ? e.detail : `PKR ${formatPkr(e.amount)}, ${e.detail.charAt(0).toLowerCase()}${e.detail.slice(1)}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      </div>

      {/* The payslip */}
      <figure className="relative w-full max-w-[34rem] lg:col-span-5 lg:row-start-1 lg:col-start-8 lg:justify-self-end lg:pt-4">
        <div className="mx-sheet px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
          <div className="mx-print">
            <header style={{ '--i': 0 } as CSSProperties} className="flex items-start justify-between gap-4 border-b border-[var(--mx-rule)] pb-4">
              <div>
                <p className="font-display text-lg font-bold tracking-tight">Payslip, September 2026</p>
                <p className="mt-0.5 text-sm text-[var(--mx-ink-2)]">Sara Ahmed, Senior Software Engineer</p>
              </div>
              <span className="shrink-0 rounded-[6px] bg-[var(--mx-paper)] px-2 py-1 text-xs font-semibold text-[var(--mx-ink-2)]">Draft</span>
            </header>

            <div style={{ '--i': 1 } as CSSProperties} className="pt-3">
              <Line label="Basic salary" value={p.base} />
              <Line label="Unpaid leave, 2 days" source="Time off" value={p.unpaidDeduction} debit on={on.leave} />
              <Line label="Q3 bonus" source="Payroll items" value={p.taxableEarnings} on={on.bonus} />
            </div>
            <div style={{ '--i': 2 } as CSSProperties} className="border-y border-[var(--mx-rule)]">
              <Line label="Gross pay" value={p.gross} strong />
            </div>
            <div style={{ '--i': 3 } as CSSProperties} className="pt-1">
              <Line label="Income tax" source="Rule set" value={p.tax} debit />
              <Line label="EOBI, 1%" source="Rule set" value={p.eobi} debit />
              <Line label="Provident fund, 8%" source="Rule set" value={p.pf} debit />
              <Line label="Laptop loan, 4 of 12" source="Loans" value={p.recoveries} debit on={on.loan} />
              <Line label="Fuel claim, reimbursed" source="Expenses" value={p.reimbursements} on={on.claim} />
            </div>

            <div style={{ '--i': 4 } as CSSProperties} className="mt-3 flex items-end justify-between gap-4 border-t-2 border-[var(--mx-ink)] pt-4">
              <div>
                <p className="text-sm font-semibold">Net pay</p>
                <p className="text-xs text-[var(--mx-ink-2)]">To Meezan Bank, account ending 4471</p>
              </div>
              <p className="mx-display mx-num text-[2.5rem] sm:text-5xl">
                <span className="mr-1.5 align-top text-base font-semibold tracking-normal text-[var(--mx-ink-2)] [font-variation-settings:normal]">PKR</span>
                <RollingNumber value={p.net} format={fmt} />
              </p>
            </div>

            {/* Where each rupee of gross went */}
            <div style={{ '--i': 5 } as CSSProperties} className="mt-5">
              <div className="flex h-2 overflow-hidden rounded-full bg-[var(--mx-paper)]" aria-hidden="true">
                {split.map((s) => (
                  <span
                    key={s.key}
                    className="h-full transition-[width] duration-[620ms] [transition-timing-function:var(--mx-ease-out)]"
                    style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                  />
                ))}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--mx-ink-2)]">
                {split
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <li key={s.key} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                      {s.label} <span className="mx-num">{Math.round((s.value / total) * 100)}%</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-perf" aria-hidden="true" />
        <p className="sr-only" aria-live="polite">
          Net pay PKR {formatPkr(p.net)}, gross PKR {formatPkr(p.gross)}, income tax PKR {formatPkr(p.tax)}.
        </p>
        <figcaption className="mt-3 max-w-[60ch] text-xs leading-relaxed text-[var(--mx-ink-2)]">
          Worked out in your browser with the same calculation and default Pakistan rule set a MatrixHR payroll run uses.
          Tax slabs and EOBI and provident-fund rates are versioned by effective date, so a new budget applies from the day it
          starts. This is a demonstration, not tax advice.
        </figcaption>
      </figure>
    </div>
  );
}
