'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, Hourglass, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';

const ADMIN_ROLES = ['COMPANY_ADMIN', 'HR_MANAGER'];

/** One quiet strip above the page for company admins and HR managers. Everyone else never sees it. */
export function BillingBanner() {
  const { user } = useAuth();
  const b = user?.billing;
  if (!user || !b?.banner || !ADMIN_ROLES.includes(user.role)) return null;

  const end = b.periodEnd ? formatDate(b.periodEnd) : '';
  const trial = b.subscription?.status === 'trialing';
  const what = trial ? 'Your free trial' : 'Your plan';
  const spec = {
    due_soon: { icon: Clock, tone: 'info', text: `${what} ends on ${end}${b.daysToEnd != null && b.daysToEnd >= 0 ? ` (${b.daysToEnd} day${b.daysToEnd === 1 ? '' : 's'} left)` : ''}.`, cta: 'Renew' },
    grace: { icon: AlertTriangle, tone: 'warning', text: `${what} ended on ${end}. Everything still works until ${b.graceEndsAt ? formatDate(b.graceEndsAt) : 'the grace period ends'}, then only billing stays open.`, cta: 'Pay now' },
    pending: { icon: Hourglass, tone: 'info', text: 'Your payment proof is being checked. We will email you as soon as it is approved.', cta: 'View status' },
    provisional: { icon: Hourglass, tone: 'warning', text: `Temporary access until ${b.provisionalUntil ? formatDate(b.provisionalUntil) : 'review finishes'} while we check your payment.`, cta: 'View status' },
    rejected: { icon: XCircle, tone: 'danger', text: `We could not approve your last payment${b.rejectedReason ? `: ${b.rejectedReason}` : '.'}`, cta: 'Start a new payment' },
    lapsed: { icon: AlertTriangle, tone: 'danger', text: 'Your subscription has ended.', cta: 'Pay now' },
  }[b.banner];
  const Icon = spec.icon;
  const tones: Record<string, string> = {
    info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    danger: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
  };

  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm sm:px-6 ${tones[spec.tone]}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{spec.text}</p>
      <Link href="/billing" className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">{spec.cta}</Link>
    </div>
  );
}
