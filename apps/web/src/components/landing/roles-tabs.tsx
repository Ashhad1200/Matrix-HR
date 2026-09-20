'use client';

import { useId, useRef, useState } from 'react';
import { Frame, Shot } from './shot';
import { cn } from '@/lib/utils';

const ROLES = [
  {
    id: 'admin',
    label: 'HR and admin',
    shot: 'dashboard',
    alt: 'MatrixHR admin dashboard showing headcount, attendance and pending leave',
    title: 'Everything, with the controls',
    lead: 'HR and company admins get the whole system: every module, every record, and the settings behind them.',
    points: [
      'Headcount, attendance and open roles on one screen',
      'Payroll runs, reports and company settings',
      'Custom fields, workflows and the audit log',
    ],
  },
  {
    id: 'manager',
    label: 'Managers',
    shot: 'manager',
    alt: 'MatrixHR manager dashboard showing team size and pending approvals',
    title: 'Your team, nothing else',
    lead: 'Managers see their own reports and the requests waiting on them. Pay and ID fields stay hidden.',
    points: [
      'Approve leave and timesheets from one queue',
      'See who is out today across your reports',
      'Run 1-on-1s and reviews without asking HR for access',
    ],
  },
  {
    id: 'employee',
    label: 'Employees',
    shot: 'employee',
    alt: 'MatrixHR employee portal showing leave balance and time clock',
    title: 'Self-service that stays in its lane',
    lead: 'Employees see their own leave, time and pay, and raise requests without going through HR.',
    points: [
      'Request leave and see the balance before you ask',
      'Clock in and read your own pay stubs',
      'Update your details without an email to HR',
    ],
  },
] as const;

export function RolesTabs() {
  const [active, setActive] = useState(0);
  const uid = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === 'ArrowRight' ? (i + 1) % ROLES.length : e.key === 'ArrowLeft' ? (i - 1 + ROLES.length) % ROLES.length : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  const role = ROLES[active];

  return (
    <div>
      <div role="tablist" aria-label="Portal" className="inline-flex rounded-xl bg-[hsl(var(--muted))] p-1">
        {ROLES.map((r, i) => (
          <button
            key={r.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            id={`${uid}-tab-${r.id}`}
            aria-selected={i === active}
            aria-controls={`${uid}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200',
              i === active
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-soft'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${role.id}`}
        className="mt-8 grid items-center gap-8 lg:grid-cols-12 lg:gap-12"
      >
        <div key={role.id} className="animate-fade-in lg:col-span-4">
          <h3 className="font-display text-2xl font-bold leading-tight tracking-tight">{role.title}</h3>
          <p className="mt-3 text-[hsl(var(--muted-foreground))]">{role.lead}</p>
          <ul className="mt-5 space-y-3 text-[hsl(var(--muted-foreground))]">
            {role.points.map((p) => (
              <li key={p} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-brand-600 dark:bg-brand-400" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-8">
          <Frame>
            <Shot key={role.id} name={role.shot} alt={role.alt} sizes="(min-width: 1024px) 60vw, 100vw" className="animate-fade-in" />
          </Frame>
        </div>
      </div>
    </div>
  );
}
