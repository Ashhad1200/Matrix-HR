'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion, useInView } from './motion';
import { cn } from '@/lib/utils';

/** Message texts match apps/api/src/whatsapp/whatsapp.service.ts. */
const CODE = 'K7QH4XWP';
const MESSAGES: { from: 'bot' | 'me'; text: string; time: string }[] = [
  {
    from: 'bot',
    time: '10:41',
    text: `📋 Leave Request\n\nSara Ahmed has requested 2 day(s) of Casual Leave.\n\nReply:\n✅ APPROVE ${CODE}\n❌ REJECT ${CODE}\n\nThe code works once and expires in 24 hours.`,
  },
  { from: 'me', time: '10:42', text: `APPROVE ${CODE}` },
  { from: 'bot', time: '10:42', text: '✅ Approved.' },
];

export function WhatsAppThread() {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setShown(MESSAGES.length);
      return;
    }
    const timers = [250, 1500, 2400].map((ms, i) => window.setTimeout(() => setShown(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="mx-auto w-full max-w-[24rem]">
      <div className="overflow-hidden rounded-[22px] bg-[#e9e3da] shadow-[0_30px_70px_-30px_rgb(8_37_28/0.45)] ring-1 ring-black/5 dark:bg-[#0f1a16] dark:ring-white/10">
        <div className="flex items-center gap-3 bg-[#0b4f3c] px-4 py-3 text-white">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 font-display text-sm font-bold">
            M
          </span>
          <div className="leading-tight">
            <p className="text-[0.9375rem] font-semibold">MatrixHR</p>
            <p className="text-xs text-white/70">Business account</p>
          </div>
        </div>
        <ol className="flex min-h-[25rem] flex-col gap-2 px-3 py-4" aria-label="WhatsApp conversation">
          {MESSAGES.map((m, i) => (
            <li
              key={i}
              className={cn(
                'max-w-[85%] whitespace-pre-line rounded-[10px] px-3 pb-1.5 pt-2 text-[0.875rem] leading-snug shadow-sm transition-[opacity,transform] duration-[460ms] [transition-timing-function:var(--mx-ease-out)]',
                m.from === 'me'
                  ? 'self-end rounded-tr-[3px] bg-[#d9fdd3] text-[#0b1f19] dark:bg-[#005c4b] dark:text-white'
                  : 'self-start rounded-tl-[3px] bg-white text-[#0b1f19] dark:bg-[#1f2c33] dark:text-white',
                i < shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
              )}
            >
              {m.text}
              <span className="mt-0.5 block text-right text-[0.6875rem] text-black/60 dark:text-white/75">{m.time}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
