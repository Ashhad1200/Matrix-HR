'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { TRIAL_DAYS, currencyForTimeZone, formatMoney, type Currency } from '@matrixhr/shared';
import type { PricingData } from '@/lib/pricing-server';
import { cn } from '@/lib/utils';

/** Prices come from the live price list (both currencies set by hand in the backoffice), so the site shows what a customer is quoted. */
const COPY: Record<string, { fit: string; adds: string[] }> = {
  starter: {
    fit: 'For getting leave and attendance off spreadsheets.',
    adds: ['Employee records and documents', 'Leave, holidays and approvals', 'Attendance, web clock-in and biometric terminals', 'Self-service for every employee'],
  },
  growth: {
    fit: 'For running payroll in MatrixHR.',
    adds: ['Payroll with a second approver', 'Payslip PDFs and bank files', 'Recruitment and onboarding', 'WhatsApp approvals'],
  },
  business: {
    fit: 'For reviews, learning and your own integrations.',
    adds: ['Performance reviews, goals and 360s', 'Courses and learning', 'Report builder', 'API keys and webhooks'],
  },
};
const EXTENDS: Record<string, string> = { growth: 'Starter', business: 'Growth' };

const LABEL: Record<Currency, string> = { PKR: 'PKR', USD: 'USD' };

/**
 * `initial` is the server's guess from the visitor's country (Cloudflare header, then geo-IP). When it could not tell,
 * the browser time zone decides (Asia/Karachi means PKR). The switch always wins.
 */
export function Pricing({ data, initial }: { data: PricingData; initial: Currency | null }) {
  const offered = data.currencies;
  const [people, setPeople] = useState(40);
  const [currency, setCurrency] = useState<Currency>(initial && offered.includes(initial) ? initial : offered[0]);
  const sliderId = useId();
  useEffect(() => {
    if (initial) return;
    try {
      const guess = currencyForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (offered.includes(guess)) setCurrency(guess);
    } catch { /* keep the default */ }
  }, [initial, offered]);
  const usd = (n: number | null | undefined) => formatMoney(n, currency);

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
              max={400}
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
          Flat monthly prices in {currency === 'PKR' ? 'Pakistani rupees' : 'US dollars'}, paid by bank transfer. Every plan starts with a {TRIAL_DAYS}-day free trial and 100 AI credits.
        </p>
        {offered.length > 1 && (
          <div role="radiogroup" aria-label="Currency" className="inline-flex shrink-0 rounded-[4px] border border-[var(--mx-rule)] p-0.5 text-sm font-semibold">
            {offered.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)}
                className={cn('cursor-pointer rounded-[3px] px-3 py-1.5 transition-colors', currency === c ? 'bg-[var(--mx-ink)] text-[var(--mx-paper)]' : 'text-[var(--mx-ink-2)] hover:text-[var(--mx-ink)]')}>{LABEL[c]}</button>
            ))}
          </div>
        )}
      </div>

      <ol className="divide-y divide-[var(--mx-rule)]">
        {data.plans.map((pl) => {
          const p = { code: pl.code, name: pl.name, maxEmployees: pl.maxEmployees ?? 0, maxAdminUsers: pl.maxAdminUsers ?? 0, aiCreditsMonthly: pl.aiCreditsMonthly, ...pl[currency] } as { code: string; name: string; maxEmployees: number; maxAdminUsers: number; aiCreditsMonthly: number; monthly: number | null; yearly: number | null; overagePerEmployee: number | null };
          if (p.monthly == null) return null;
          const copy = COPY[p.code] ?? { fit: '', adds: [] };
          const pick = p.code === 'growth';
          const over = p.overagePerEmployee ? Math.max(people - p.maxEmployees, 0) * p.overagePerEmployee : 0;
          const tooBig = !p.overagePerEmployee && people > p.maxEmployees;
          return (
            <li key={p.code} className={cn('grid gap-x-8 gap-y-4 py-7 lg:grid-cols-12 lg:items-start', pick && 'relative -mx-4 bg-[var(--mx-sheet)] px-4 shadow-[0_0_0_1px_var(--mx-rule)] sm:-mx-6 sm:px-6 lg:rounded-[4px]')}>
              <div className="lg:col-span-3">
                <h3 className="font-display text-2xl font-bold tracking-tight">
                  {p.name}
                  {pick && <span className="ml-3 align-middle text-xs font-semibold text-[var(--mx-signal)]">Includes payroll</span>}
                </h3>
                <p className="mt-1 text-sm text-[var(--mx-ink-2)]">{copy.fit}</p>
              </div>
              <ul className="grid gap-1.5 text-[0.9375rem] sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
                {EXTENDS[p.code] && <li className="text-sm text-[var(--mx-ink-2)]">Everything in {EXTENDS[p.code]}, plus</li>}
                <li className="flex gap-2"><span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-[var(--mx-ink)]" />Up to {p.maxEmployees} employees{p.overagePerEmployee ? `, then ${usd(p.overagePerEmployee)} each` : ''}</li>
                {copy.adds.map((a) => (
                  <li key={a} className="flex gap-2"><span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-[var(--mx-ink)]" />{a}</li>
                ))}
                <li className="flex gap-2"><span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-[var(--mx-ink)]" />{p.maxAdminUsers} admin users and {p.aiCreditsMonthly.toLocaleString('en-US')} AI credits a month</li>
              </ul>
              <div className="flex items-end justify-between gap-6 lg:col-span-4 lg:flex-col lg:items-end">
                <div className="lg:text-right">
                  <p className="mx-num"><span className="font-display text-3xl font-bold tracking-tight">{usd(p.monthly)}</span><span className="text-sm text-[var(--mx-ink-2)]"> a month</span></p>
                  <p className="mx-num mt-1 text-sm text-[var(--mx-ink-2)]">{usd(p.yearly)} a year, two months free</p>
                  <p className="mx-num mt-1 text-sm font-medium">
                    {tooBig ? `Over the ${p.maxEmployees}-employee limit for ${people} people` : `${usd((p.monthly ?? 0) + over)} a month for ${people} people`}
                  </p>
                </div>
                <Link href="/signup" data-cta="pricing" className={cn('mx-btn h-11 text-[0.9375rem]', pick ? 'mx-btn-primary' : 'mx-btn-quiet')}>Start free trial</Link>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 max-w-[70ch] text-sm leading-relaxed text-[var(--mx-ink-2)]">
        Need more AI credits? Packs never expire: {data.creditPacks.filter((k) => k[currency] != null).map((k) => `${k.credits.toLocaleString('en-US')} for ${usd(k[currency])}`).join(', ')}.
        Larger teams or special requirements: ask us about Enterprise from inside your trial.
      </p>
    </div>
  );
}
