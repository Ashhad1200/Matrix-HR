'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mirrors EmployeesService.findOneFor: HR and the employee themself get the full record, everyone else in the
 * company gets the directory view, and a user from another company gets "Employee not found".
 */
type ViewerId = 'self' | 'manager' | 'colleague' | 'hr' | 'outsider';

const VIEWERS: { id: ViewerId; name: string; who: string; note: string }[] = [
  { id: 'self', name: 'Sara', who: 'herself', note: 'Employees see their whole record, including pay, and can update their own contact details.' },
  { id: 'manager', name: 'Ali', who: 'her manager', note: 'Managers approve Sara’s leave and run her reviews, but her pay, national ID and bank details stay hidden.' },
  { id: 'colleague', name: 'Maryam', who: 'a colleague', note: 'Colleagues get the directory: who Sara is, what she does and who she reports to.' },
  { id: 'hr', name: 'Hina', who: 'HR', note: 'HR and company admins see everything, and every change they make is written to the audit log.' },
  { id: 'outsider', name: 'Someone', who: 'at another company', note: 'Another company on MatrixHR gets nothing at all, not even confirmation that Sara exists.' },
];

const FIELDS: { label: string; value: string; private?: boolean }[] = [
  { label: 'Employee code', value: 'ACME-0142' },
  { label: 'Job title', value: 'Senior Software Engineer' },
  { label: 'Department', value: 'Engineering' },
  { label: 'Reports to', value: 'Ali Khan' },
  { label: 'Work email', value: 'sara.ahmed@acme.com' },
  { label: 'Basic salary', value: 'PKR 285,000 a month', private: true },
  { label: 'National ID', value: '•••• •••• 0142', private: true },
  { label: 'Bank account', value: 'Account ending 4471', private: true },
];

export function RecordLens() {
  const [viewer, setViewer] = useState<ViewerId>('manager');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = useId();
  const v = VIEWERS.find((x) => x.id === viewer)!;
  const full = viewer === 'self' || viewer === 'hr';

  function onKey(e: KeyboardEvent, i: number) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + VIEWERS.length) % VIEWERS.length;
    setViewer(VIEWERS[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <p id={`${panelId}-label`} className="text-sm font-semibold">
          Look at Sara&rsquo;s record as
        </p>
        <div role="tablist" aria-labelledby={`${panelId}-label`} className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {VIEWERS.map((x, i) => (
            <button
              key={x.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              type="button"
              aria-selected={viewer === x.id}
              aria-controls={panelId}
              tabIndex={viewer === x.id ? 0 : -1}
              onClick={() => setViewer(x.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'cursor-pointer rounded-[10px] px-3.5 py-2.5 text-left text-[0.9375rem] transition-[background-color,box-shadow,color] duration-150 lg:py-3',
                viewer === x.id
                  ? 'bg-[var(--mx-ink)] text-[var(--mx-paper)]'
                  : 'text-[var(--mx-ink)] shadow-[inset_0_0_0_1px_var(--mx-rule)] hover:shadow-[inset_0_0_0_1px_var(--mx-ink)] lg:shadow-none lg:hover:bg-[var(--mx-sheet)]',
              )}
            >
              <span className="font-semibold">{x.name}</span>, {x.who}
            </button>
          ))}
        </div>
        <p key={v.id} className="mt-5 max-w-[46ch] animate-fade-in text-[var(--mx-ink-2)]">
          {v.note}
        </p>
      </div>

      <div id={panelId} role="tabpanel" aria-live="polite" className="lg:col-span-7">
        <div className="mx-sheet min-h-[27rem] rounded-[4px] p-5 sm:p-7">
          {viewer === 'outsider' ? (
            <div className="grid min-h-[23rem] animate-fade-in place-items-center text-center">
              <div>
                <p className="mx-num font-display text-6xl font-bold tracking-tight text-[var(--mx-rule)]">404</p>
                <p className="mt-2 font-medium">Employee not found</p>
                <p className="mx-auto mt-1 max-w-[34ch] text-sm text-[var(--mx-ink-2)]">
                  Every query is scoped to the viewer&rsquo;s company before it reaches the database.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 border-b border-[var(--mx-rule)] pb-5">
                <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full bg-[var(--mx-signal-soft)] font-display text-lg font-bold text-[#13553c] dark:text-[var(--mx-signal)]">
                  SA
                </span>
                <div>
                  <p className="font-display text-2xl font-bold tracking-tight">Sara Ahmed</p>
                  <p className="text-sm text-[var(--mx-ink-2)]">{full ? 'Full record' : 'Directory view'}</p>
                </div>
              </div>
              <dl className="grid gap-x-8 sm:grid-cols-2">
                {FIELDS.map((f) => {
                  const hidden = f.private && !full;
                  return (
                    <div key={f.label} className="border-b border-[var(--mx-rule)] py-3 last:border-0 sm:[&:nth-last-child(2)]:border-0">
                      <dt className="text-xs font-medium text-[var(--mx-ink-2)]">{f.label}</dt>
                      <dd className="mt-1">
                        {hidden ? (
                          <>
                            <span aria-hidden="true" className="mx-redact inline-block text-[0.9375rem]">
                              {f.value}
                            </span>
                            <span className="sr-only">Hidden for this viewer</span>
                          </>
                        ) : (
                          <span className={cn('text-[0.9375rem]', f.private && 'mx-num')}>{f.value}</span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
