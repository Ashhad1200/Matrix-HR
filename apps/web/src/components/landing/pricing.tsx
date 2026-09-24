'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { PRICING_TIERS } from '@matrixhr/shared';
import { formatPkr } from '@/lib/payslip';
import { cn } from '@/lib/utils';

/** Plan contents follow docs/product.md; prices come from PRICING_TIERS so the page and the code agree. */
const PLANS = [
  {
    key: 'starter' as const,
    fit: 'For getting leave and attendance off spreadsheets.',
    adds: ['Employee records and documents', 'Leave, holidays and approvals', 'Attendance, web clock-in and biometric terminals', 'Self-service for every employee'],
  },
  {
    key: 'growth' as const,
    fit: 'For running payroll in MatrixHR.',
    adds: ['Payroll with a second approver', 'Payslip PDFs and bank files', 'Recruitment and onboarding', 'WhatsApp approvals'],
    pick: true,
  },
  {
    key: 'pro' as const,
    fit: 'For reviews, learning and your own integrations.',
    adds: ['Performance reviews, goals and 360s', 'Courses and learning', 'Report builder', 'API keys and webhooks'],
  },
  {
    key: 'enterprise' as const,
    fit: 'For larger teams with their own requirements.',
    adds: ['Single sign-on', 'Ask MatrixHR assistant', 'A named contact and an SLA'],
  },
];

export function Pricing() {
  const [people, setPeople] = useState(40);
  const sliderId = useId();

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-[var(--mx-ink)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md">
          <label htmlFor={sliderId} className="text-sm font-semibold">
            Your headcount
          </label>
          <div className="mt-2 flex items-center gap-4">
            <input
              id={sliderId}
              type="range"
              min={5}
              max={500}
              step={5}
              value={people}
              onChange={(e) => setPeople(Number(e.target.value))}
              className="mx-range w-full"
              aria-valuetext={`${people} employees`}
            />
            <output htmlFor={sliderId} className="mx-num w-24 shrink-0 text-right font-display text-3xl font-bold tracking-tight">
              {people}
            </output>
          </div>
        </div>
        <p className="max-w-[34ch] text-sm text-[var(--mx-ink-2)] sm:text-right">
          Prices in Pakistani rupees, per employee, per month. Every plan starts with a 30-day trial.
        </p>
      </div>

      <ol className="divide-y divide-[var(--mx-rule)]">
        {PLANS.map((p) => {
          const tier = PRICING_TIERS[p.key];
          const price = tier.pricePkr;
          return (
            <li
              key={p.key}
              className={cn(
                'grid gap-x-8 gap-y-4 py-7 lg:grid-cols-12 lg:items-start',
                p.pick && 'relative -mx-4 bg-[var(--mx-sheet)] px-4 shadow-[0_0_0_1px_var(--mx-rule)] sm:-mx-6 sm:px-6 lg:rounded-[4px]',
              )}
            >
              <div className="lg:col-span-3">
                <h3 className="font-display text-2xl font-bold tracking-tight">
                  {tier.name}
                  {p.pick && <span className="ml-3 align-middle text-xs font-semibold text-[var(--mx-signal)]">Includes payroll</span>}
                </h3>
                <p className="mt-1 text-sm text-[var(--mx-ink-2)]">{p.fit}</p>
              </div>
              <ul className="grid gap-1.5 text-[0.9375rem] sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
                {p.key !== 'starter' && (
                  <li className="text-sm text-[var(--mx-ink-2)]">Everything in {p.key === 'growth' ? 'Starter' : p.key === 'pro' ? 'Growth' : 'Pro'}, plus</li>
                )}
                {p.adds.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-[var(--mx-ink)]" />
                    {a}
                  </li>
                ))}
              </ul>
              <div className="flex items-end justify-between gap-6 lg:col-span-4 lg:flex-col lg:items-end">
                {price ? (
                  <div className="lg:text-right">
                    <p className="mx-num">
                      <span className="font-display text-3xl font-bold tracking-tight">PKR {formatPkr(price)}</span>
                      <span className="text-sm text-[var(--mx-ink-2)]"> per person</span>
                    </p>
                    <p className="mx-num mt-1 text-sm text-[var(--mx-ink-2)]">
                      PKR {formatPkr(price * people)} a month for {people} people
                    </p>
                  </div>
                ) : (
                  <div className="lg:text-right">
                    <p className="font-display text-3xl font-bold tracking-tight">Priced with you</p>
                    <p className="mt-1 text-sm text-[var(--mx-ink-2)]">Based on headcount and what you need</p>
                  </div>
                )}
                <Link href="/signup" className={cn('mx-btn h-11 text-[0.9375rem]', p.pick ? 'mx-btn-primary' : 'mx-btn-quiet')}>
                  Start free trial
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
