import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getBrand } from '@/lib/brand-server';
import { Logo } from '@/components/brand/logo';
import { LandingNav } from '@/components/landing/nav';
import { PayslipDemo } from '@/components/landing/payslip-demo';
import { Sources } from '@/components/landing/sources';
import { RunSequence } from '@/components/landing/run-sequence';
import { WhatsAppThread } from '@/components/landing/whatsapp-thread';
import { RecordLens } from '@/components/landing/record-lens';
import { Pricing } from '@/components/landing/pricing';
import { In } from '@/components/landing/motion';
import { GoogleAnalytics } from '@/components/landing/google-analytics';
import { TRIAL_DAYS } from '@matrixhr/shared';
import { headers } from 'next/headers';
import { detectCurrency } from '@/lib/geo';
import { getPricing, type PricingData } from '@/lib/pricing-server';
import { siteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

// Direction and rules for this page: docs/brand/landing.md

const WRAP = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

const MODULES: { group: string; items: [string, string][] }[] = [
  {
    group: 'People',
    items: [
      ['Employee records', 'Documents, departments, designations and an org chart, imported in bulk.'],
      ['Recruitment', 'Post roles and move candidates across a board.'],
      ['Pre-boarding', 'Signed paperwork collected before day one.'],
      ['Onboarding', 'Checklists from templates, tracked to done.'],
      ['Offboarding', 'An exit workflow that ends in a final settlement.'],
    ],
  },
  {
    group: 'Time',
    items: [
      ['Time off', 'Policies, balances, holidays and a calendar of who is out.'],
      ['Time clock', 'Clock in from a browser or a ZKTeco terminal.'],
      ['Timesheets', 'Hours against projects, approved by managers.'],
    ],
  },
  {
    group: 'Pay',
    items: [
      ['Payroll', 'Monthly runs with tax, social security and provident fund.'],
      ['Expenses', 'Claims by category, reimbursed through payroll.'],
      ['Loans and advances', 'Approved in the app, recovered in instalments.'],
      ['Pay components', 'Allowances, bonuses, arrears and deductions, per person, straight into the run.'],
      ['Pay stubs', 'Each employee reads their own, and nobody else’s.'],
    ],
  },
  {
    group: 'Talent',
    items: [
      ['Performance', 'Review cycles, goals and 360 feedback.'],
      ['1-on-1s', 'Shared agendas between a manager and each report.'],
      ['eNPS', 'Pulse surveys, broken down by team.'],
      ['Learning', 'Courses assigned, completion tracked.'],
    ],
  },
  {
    group: 'Company',
    items: [
      ['Reports', 'Standard reports and a builder, exported to a file.'],
      ['AI assistant', 'Ask about your own data; it confirms before it changes anything.'],
      ['Activity Monitor', 'A disclosed desktop agent, installed with consent, that records time and activity only.'],
      ['Workflows', 'Approval steps you define, per request type.'],
      ['Custom fields', 'The fields your company tracks that ours do not.'],
      ['Audit log', 'Who changed what, and when.'],
    ],
  },
];

const SECURITY: [string, string][] = [
  ['Two-factor sign-in', 'Authenticator-app codes, with recovery codes for a lost phone.'],
  ['Lockout on repeated failures', 'Wrong passwords lock the account instead of inviting more guesses.'],
  ['Sessions end when a password changes', 'Every other session is signed out, and refresh tokens rotate on use.'],
  ['Encrypted integration keys', 'Bank, device and accounting credentials are encrypted at rest.'],
  ['Signed WhatsApp webhooks', 'Messages that do not carry Meta’s signature are ignored.'],
  ['Audit log', 'Sensitive changes are recorded with who made them and when.'],
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Which countries does payroll cover?',
    a: 'Payroll is calculated only for the countries whose rule sets are built in, so confirm coverage for your team before you commit.',
  },
  {
    q: 'Are the tax slabs up to date with the latest budget?',
    a: 'Tax slabs, social-security and provident-fund rates live in a rule set that is versioned by effective date. Check the rates against your own advisor for the current fiscal year before your first live run.',
  },
  {
    q: 'Who can see salary, national ID and bank details?',
    a: 'HR, company admins and the employee themself. Managers and colleagues get the directory view, which leaves pay, ID and bank fields out entirely.',
  },
  {
    q: 'How do biometric devices connect?',
    a: 'ZKTeco terminals push punches to MatrixHR, where they sit next to browser clock-ins and feed attendance. Device credentials are stored encrypted.',
  },
  {
    q: 'Can managers approve from their phone?',
    a: 'Yes. The web app works on a phone, and managers can approve or reject leave from WhatsApp with a one-time code that expires in 24 hours.',
  },
  {
    q: 'What happens when someone leaves?',
    a: 'Offboarding runs as a workflow with tasks for each team, then works out a final settlement, including leave encashment and any loan balance still owed.',
  },
  {
    q: 'Can we connect our own tools?',
    a: 'Yes. Create scoped API keys, receive webhooks with retries, export the payroll journal to QuickBooks, and set up single sign-on.',
  },
  {
    q: 'Do you offer employee monitoring?',
    a: 'Yes, as a disclosed, optional module that is off until you turn it on. An employee installs the agent themselves after accepting your policy, and it shows a tray icon the whole time. It records time and activity only — active and idle time, mouse and keyboard counts, and the app or website in focus — never keystrokes, the screen, or the contents of anything. Each person can see everything collected about them, and HR is alerted if an agent stops reporting.',
  },
  {
    q: 'Can we be billed in US dollars?',
    a: 'Yes. You are billed in US dollars, or in your local currency where we offer one, chosen from your country at sign-up. Each plan has a set price in each currency — there is no live conversion — and you pay by bank transfer either way.',
  },
  {
    q: 'Can we run it under our own brand?',
    a: 'Resellers can run MatrixHR white-label: your product name, logo, colours, support address and domain throughout the app, emails and payslips, with many client companies on one server. A single company can also run its own private copy. Ask us about either.',
  },
  {
    q: 'How does the trial work?',
    a: 'Create your company and choose a subdomain. You become the company admin on the Growth plan for 30 days, with 100 AI credits. To keep going afterwards, pay by bank transfer from the Billing page; if you do not, the workspace pauses after a short grace period and your data stays safe.',
  },
];

function JsonLd({ pricing }: { pricing: PricingData | null }) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'MatrixHR',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: siteUrl,
        description:
          'HR and payroll for growing companies: attendance, leave, expenses, loans and payroll with a second approver, payslips and bank files.',
        offers: (pricing?.plans ?? []).map((p) => ({
          '@type': 'Offer',
          name: p.name,
          price: p.USD.monthly,
          priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: p.USD.monthly, priceCurrency: 'USD', unitText: 'per month' },
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default async function LandingPage() {
  // The vendor's marketing page is never shown on a white-label install: visitors go straight to the sign-in.
  if (getBrand().whiteLabel) redirect('/login');
  const singleCompany = (process.env.SINGLE_COMPANY_MODE || '').toLowerCase() === 'true';
  const [pricing, detected] = singleCompany ? [null, null] : await Promise.all([getPricing(), detectCurrency(headers())]);
  return (
    <div className="mx relative min-h-dvh overflow-x-clip">
      <JsonLd pricing={pricing} />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <LandingNav />

      <main id="main">
        {/* 1. Hero: the live payslip */}
        <section aria-labelledby="hero-title" className={cn(WRAP, 'pb-24 pt-8 sm:pt-12 lg:pb-32 lg:pt-14')}>
          <PayslipDemo
            intro={
              <>
                <h1 id="hero-title" className="mx-display max-w-[12ch] text-[clamp(3rem,7vw,6.4rem)]">
                  HR and payroll software that shows its working.
                </h1>
                <p className="mt-7 max-w-[44ch] text-lg leading-relaxed text-[var(--mx-ink-2)]">
                  Everything HR does ends up on a payslip. MatrixHR connects attendance, leave, expense claims and loans to
                  payroll, then shows its working, line by line.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
                  <Link href="/signup" className="mx-btn mx-btn-primary" data-cta="hero">
                    Start free trial
                  </Link>
                  <a href="#pricing" className="mx-btn mx-btn-quiet">
                    See pricing
                  </a>
                  <span className="text-sm text-[var(--mx-ink-2)] sm:ml-2">{TRIAL_DAYS} days free, 100 AI credits.</span>
                </div>
              </>
            }
          />
        </section>

        {/* 2. The problem: five sources settle into one run */}
        <Sources />

        {/* 3. The run: maker-checker, pinned on desktop */}
        <section id="run" aria-labelledby="run-title" className="scroll-mt-16 pt-24 sm:pt-32">
          <div className={WRAP}>
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="run-title" className="mx-h2 lg:col-span-6">
                A payroll run that takes two people to approve.
              </h2>
              <p className="max-w-[48ch] text-lg leading-relaxed text-[var(--mx-ink-2)] lg:col-span-5 lg:col-start-8 lg:self-end">
                The mistakes that cost the most are the ones nobody else looked at. MatrixHR will not let the person who
                prepared a run approve it.
              </p>
            </div>
            <div className="mt-14 lg:mt-0">
              <RunSequence />
            </div>
          </div>
        </section>

        {/* 4. WhatsApp approvals */}
        <section id="whatsapp" aria-labelledby="wa-title" className="scroll-mt-16 border-y border-[var(--mx-rule)] bg-[var(--mx-sheet)] py-24 sm:py-32">
          <div className={cn(WRAP, 'grid items-center gap-14 lg:grid-cols-12 lg:gap-8')}>
            <div className="lg:col-span-6">
              <h2 id="wa-title" className="mx-h2 max-w-[16ch]">
                Managers approve leave without opening a laptop.
              </h2>
              <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--mx-ink-2)]">
                The request arrives on WhatsApp with a one-time code. The manager replies with it, the leave is approved,
                and the balance updates straight away.
              </p>
              <dl className="mt-10 grid max-w-xl gap-x-10 gap-y-6 sm:grid-cols-2">
                {[
                  ['Works once', 'Each code approves one request, then expires within 24 hours.'],
                  ['Hard to mistype', 'Codes leave out 0, O, 1 and I, so they read cleanly off a screen.'],
                  ['Opt-in', 'Employees consent before messages start, and STOP ends them.'],
                  ['On the record', 'Approvals from chat go into the audit log, like any other.'],
                ].map(([t, d], i) => (
                  <In key={t} delay={i * 70}>
                    <dt className="font-semibold">{t}</dt>
                    <dd className="mt-1 text-[var(--mx-ink-2)]">{d}</dd>
                  </In>
                ))}
              </dl>
            </div>
            <div className="lg:col-span-5 lg:col-start-8">
              <WhatsAppThread />
            </div>
          </div>
        </section>

        {/* 5. Access: one record, five viewers */}
        <section id="access" aria-labelledby="access-title" className="scroll-mt-16 py-24 sm:py-32">
          <div className={WRAP}>
            <h2 id="access-title" className="mx-h2 max-w-[20ch]">
              One record, and exactly what each person may see of it.
            </h2>
            <div className="mt-12">
              <RecordLens />
            </div>
          </div>
        </section>

        {/* 5b. Activity Monitor — disclosed, consent-first */}
        <section id="monitor" aria-labelledby="monitor-title" className="scroll-mt-16 border-y border-[var(--mx-rule)] bg-[var(--mx-sheet)] py-24 sm:py-32">
          <div className={cn(WRAP, 'grid items-start gap-14 lg:grid-cols-12 lg:gap-8')}>
            <div className="lg:col-span-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-[var(--mx-signal)]">Optional · off by default</p>
              <h2 id="monitor-title" className="mx-h2 mt-3 max-w-[18ch]">
                Activity monitoring you can show your team.
              </h2>
              <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-[var(--mx-ink-2)]">
                A desktop agent each employee installs themselves, after reading your policy and accepting it. It shows a
                tray icon the whole time it runs, and anyone can open <em>My Activity</em> to see exactly what has been
                collected about them. Nothing is hidden, and there is no AI reading along.
              </p>
              <dl className="mt-10 grid max-w-xl gap-x-10 gap-y-6 sm:grid-cols-2">
                {[
                  ['Consent first', 'Nothing records until the employee accepts the policy and installs the agent.'],
                  ['Visible, always', 'A tray icon stays on while it runs; the person sees their own data any time.'],
                  ['Counts, not content', 'Active and idle time, mouse and keyboard counts, and the app in focus.'],
                  ['HR knows if it stops', 'An agent that goes quiet during work hours raises an alert.'],
                ].map(([t, d], i) => (
                  <In key={t} delay={i * 70}>
                    <dt className="font-semibold">{t}</dt>
                    <dd className="mt-1 text-[var(--mx-ink-2)]">{d}</dd>
                  </In>
                ))}
              </dl>
            </div>
            <div className="lg:col-span-5 lg:col-start-8">
              <div className="rounded-[6px] border border-[var(--mx-rule)] bg-[var(--mx-paper)] p-6 shadow-[0_18px_40px_-24px_rgba(8,37,28,0.35)] sm:p-8">
                <div>
                  <p className="text-sm font-semibold text-[var(--mx-ink)]">What it records</p>
                  <ul className="mt-3 space-y-2 text-[0.9375rem] text-[var(--mx-ink-2)]">
                    {['Active vs idle time', 'Mouse and keyboard event counts', 'The app or website in focus'].map((x) => (
                      <li key={x} className="flex gap-2.5"><span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mx-signal)]" />{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-7 border-t border-[var(--mx-rule)] pt-6">
                  <p className="text-sm font-semibold text-[var(--mx-ink)]">What it never records</p>
                  <ul className="mt-3 space-y-2 text-[0.9375rem] text-[var(--mx-ink-2)]">
                    {['Your keystrokes or which keys', 'Your screen or screenshots', 'Your clipboard or file contents'].map((x) => (
                      <li key={x} className="flex gap-2.5"><span aria-hidden="true" className="mt-[0.5em] h-3 w-3 shrink-0" ><svg viewBox="0 0 12 12" className="h-3 w-3 text-[var(--mx-ink-3,var(--mx-ink-2))]"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg></span>{x}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-7 text-xs leading-relaxed text-[var(--mx-ink-2)]">Data is kept for a limited time and then deleted. HR and managers see daily summaries, not keystrokes or screens, and every look is in the audit log.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. The rest of the product, as a dense index */}
        <section id="modules" aria-labelledby="modules-title" className="scroll-mt-16 bg-[var(--mx-ledger)] py-24 text-[var(--mx-ledger-ink)] sm:py-32">
          <div className={WRAP}>
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="modules-title" className="mx-h2 lg:col-span-5">
                And the rest of HR, on the same record.
              </h2>
              <p className="max-w-[46ch] text-lg leading-relaxed text-[var(--mx-ledger-ink-2)] lg:col-span-5 lg:col-start-8 lg:self-end">
                Hiring, time, pay, talent and company settings share one employee record, so a person&rsquo;s details are typed
                once and every module reads the same copy.
              </p>
            </div>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:mt-16 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-5">
              {MODULES.map((g, gi) => (
                <In key={g.group} delay={gi * 60}>
                  <h3 className="border-b border-[var(--mx-ledger-rule)] pb-3 font-display text-xl font-bold tracking-tight text-white">{g.group}</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1 sm:gap-y-4">
                    {g.items.map(([name, text]) => (
                      <div key={name}>
                        <dt className="font-medium text-white">{name}</dt>
                        <dd className="hidden text-sm leading-relaxed text-[var(--mx-ledger-ink-2)] sm:block">{text}</dd>
                      </div>
                    ))}
                  </dl>
                </In>
              ))}
            </div>

            {/* What flows in and out */}
            <div className="mt-24 grid gap-10 border-t border-[var(--mx-ledger-rule)] pt-12 lg:grid-cols-12 lg:gap-8">
              <h3 className="font-display text-2xl font-bold tracking-tight text-white lg:col-span-3">Connected both ways</h3>
              <div className="lg:col-span-4">
                <p className="text-sm font-semibold text-[var(--mx-ledger-ink-2)]">Comes in</p>
                <p className="mt-2 text-lg leading-relaxed">ZKTeco punches, browser clock-ins, and your employee list as one import file.</p>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm font-semibold text-[var(--mx-ledger-ink-2)]">Goes out</p>
                <p className="mt-2 text-lg leading-relaxed">
                  Bank files in a generic format or a bank-specific one, a QuickBooks journal, WhatsApp messages, and webhooks to your own
                  systems. Build on top with scoped API keys and single sign-on.
                </p>
              </div>
            </div>

            {/* Deployment modes */}
            <div className="mt-20 grid gap-10 border-t border-[var(--mx-ledger-rule)] pt-12 lg:grid-cols-12 lg:gap-8">
              <h3 className="font-display text-2xl font-bold tracking-tight text-white lg:col-span-3">Make it yours</h3>
              <div className="lg:col-span-4">
                <p className="text-sm font-semibold text-[var(--mx-ledger-ink-2)]">White-label, for resellers</p>
                <p className="mt-2 text-lg leading-relaxed">Your product name, logo, colours, support address and domain throughout the app, emails and payslips — with many client companies hosted on one server, all under your brand.</p>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm font-semibold text-[var(--mx-ledger-ink-2)]">Billed in your currency</p>
                <p className="mt-2 text-lg leading-relaxed">Pay in US dollars, or in your local currency where we offer one, set from the country at sign-up, by bank transfer. A single company can also run its own private copy on its own server.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Security: a claim, and how it is tested */}
        <section id="security" aria-labelledby="security-title" className="scroll-mt-16 bg-[var(--mx-sheet)] py-24 sm:py-32">
          <div className={cn(WRAP, 'grid gap-14 lg:grid-cols-12 lg:gap-8')}>
            <div className="lg:col-span-5">
              <h2 id="security-title" className="mx-h2">
                One company can never read another company&rsquo;s data.
              </h2>
              <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-[var(--mx-ink-2)]">
                Every record carries its company, and every query is scoped to it. To prove it, a test suite replays every API route as a user
                from a second company and counts anything that comes back as a failure.
              </p>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
              {SECURITY.map(([t, d]) => (
                <div key={t} className="border-t border-[var(--mx-rule)] py-5">
                  <dt className="font-semibold">{t}</dt>
                  <dd className="mt-1 text-[0.9375rem] leading-relaxed text-[var(--mx-ink-2)]">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 8. Pricing */}
        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 py-24 sm:py-32">
          <div className={WRAP}>
            <h2 id="pricing-title" className="mx-display max-w-[24ch] text-[clamp(2.6rem,5.4vw,4.75rem)]">
              Simple monthly pricing.
            </h2>
            <div className="mt-12">
              {pricing ? <Pricing data={pricing} initial={detected} /> : null}
            </div>
          </div>
        </section>

        {/* 9. Questions */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 pb-24 sm:pb-32">
          <div className={cn(WRAP, 'grid gap-10 lg:grid-cols-12 lg:gap-8')}>
            <h2 id="faq-title" className="mx-h2 lg:col-span-4">
              Questions HR teams ask first.
            </h2>
            <div className="border-t border-[var(--mx-ink)] lg:col-span-7 lg:col-start-6">
              {FAQ.map((f) => (
                <details key={f.q} className="mx-faq group border-b border-[var(--mx-rule)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="relative h-4 w-4 shrink-0">
                      <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 bg-current transition-transform duration-300 group-open:rotate-90 group-open:scale-y-0" />
                    </span>
                  </summary>
                  <p className="max-w-[62ch] pb-6 leading-relaxed text-[var(--mx-ink-2)]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 10. Close */}
        <section aria-labelledby="close-title" className="relative bg-[var(--mx-ledger)] text-[var(--mx-ledger-ink)]">
          <div aria-hidden="true" className="mx-tear absolute inset-x-0 top-0 -translate-y-full" />
          <div className={cn(WRAP, 'grid gap-10 py-24 sm:py-32 lg:grid-cols-12 lg:items-end lg:gap-8')}>
            <h2 id="close-title" className="mx-display text-[clamp(2.6rem,6vw,5.5rem)] text-white lg:col-span-8">
              Close next month in MatrixHR.
            </h2>
            <div className="lg:col-span-4">
              <p className="max-w-[36ch] text-lg leading-relaxed text-[var(--mx-ledger-ink-2)]">
                Create your company, import your people, and run a draft payroll against last month&rsquo;s numbers.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <Link
                  href="/signup"
                  data-cta="final-cta"
                  className="mx-btn bg-white text-[#0b1f19] shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)] hover:bg-[#d8f2e3]"
                >
                  Start free trial
                </Link>
                <Link href="/login" className="mx-link font-medium text-white">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      {/* The landing redirects white-label deployments to /login above, so this only runs on matrixhr's own site. */}
      <GoogleAnalytics product="matrixhr" />

      <footer className="border-t border-[var(--mx-rule)]">
        <div className={cn(WRAP, 'flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between')}>
          <div>
            <Logo markClassName="h-7 w-7" />
            <p className="mt-3 max-w-[32ch] text-sm text-[var(--mx-ink-2)]">HR and payroll for growing companies.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-[0.9375rem] sm:grid-cols-3">
            <a href="#run" className="mx-link w-fit">Payroll</a>
            <a href="#whatsapp" className="mx-link w-fit">WhatsApp approvals</a>
            <a href="#access" className="mx-link w-fit">Who sees what</a>
            <a href="#monitor" className="mx-link w-fit">Activity Monitor</a>
            <a href="#modules" className="mx-link w-fit">Modules</a>
            <a href="#security" className="mx-link w-fit">Security</a>
            <a href="#pricing" className="mx-link w-fit">Pricing</a>
            <a href="#faq" className="mx-link w-fit">Questions</a>
            <Link href="/login" className="mx-link w-fit">Sign in</Link>
            <Link href="/signup" className="mx-link w-fit" data-cta="footer">Start free trial</Link>
          </nav>
        </div>
        <div className={cn(WRAP, 'pb-10 text-sm text-[var(--mx-ink-2)]')}>
          <p>&copy; 2026 MatrixHR</p>
          <p className="mt-2">
            MatrixHR is built by <a href="https://treevoxa.com/" className="mx-link">Treevoxa, a custom software development company</a>.
            {' '}Need something MatrixHR doesn&apos;t do? See <a href="https://treevoxa.com/services/hr-software-development/" className="mx-link">custom HR software development</a>
            {' '}or <a href="https://treevoxa.com/partners/white-label-matrixhr/" className="mx-link">white-label MatrixHR for resellers</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
