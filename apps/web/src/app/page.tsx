import Link from 'next/link';
import {
  ArrowRight, ArrowDown, Briefcase, Users, MessageCircle, Target, BarChart3, KeyRound, EyeOff, ScrollText, Lock,
  RefreshCcw, Ban, Clock, Wallet, Settings2, Fingerprint, FileUp, Landmark, FileSpreadsheet, Webhook, Code2,
  LogIn, Workflow, type LucideIcon,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { LandingNav } from '@/components/landing/nav';
import { Reveal } from '@/components/landing/reveal';
import { Frame, Shot } from '@/components/landing/shot';
import { RolesTabs } from '@/components/landing/roles-tabs';
import { cn } from '@/lib/utils';

const primaryCta =
  'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-700 px-6 text-base font-medium text-white shadow-soft transition-[background-color,box-shadow,transform] duration-200 hover:bg-brand-800 hover:shadow-lifted active:scale-[0.98] dark:bg-brand-600 dark:hover:bg-brand-500';
const secondaryCta =
  'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 text-base font-medium transition-[background-color,border-color,transform] duration-200 hover:border-brand-400/70 hover:bg-[hsl(var(--muted))] active:scale-[0.98]';

const SECTION = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

const PAYROLL_STEPS = [
  {
    title: 'Import attendance',
    body: 'Web clock-ins, ZKTeco punches and approved leave feed the run, so nobody re-keys hours.',
  },
  {
    title: 'Review the run',
    body: 'Check gross pay, deductions and net pay per employee before the period is locked.',
  },
  {
    title: 'Pay and reconcile',
    body: 'Export a bank file that skips invalid accounts, post the journal to QuickBooks, and generate payslips.',
  },
];

const SECURITY = [
  { icon: KeyRound, title: 'Two-factor sign-in', body: 'Authenticator-app codes, with recovery codes for lost phones.' },
  { icon: EyeOff, title: 'Access by role and reporting line', body: 'Employees see themselves, managers see their reports, HR sees everyone. Pay and ID fields stay hidden below HR.' },
  { icon: ScrollText, title: 'Audit log', body: 'Sensitive changes are recorded with who made them and when.' },
  { icon: Lock, title: 'Encrypted integration keys', body: 'Credentials for banks, devices and accounting tools are encrypted at rest.' },
  { icon: RefreshCcw, title: 'Sessions end when passwords change', body: 'Changing a password signs out every other session. Refresh tokens rotate on use.' },
  { icon: Ban, title: 'Lockout on repeated failures', body: 'Repeated wrong passwords lock the account instead of inviting more guesses.' },
];

function IntegrationRow({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{body}</p>
      </div>
    </li>
  );
}

const HOW = [
  { title: 'Create your company', body: 'Name your workspace and choose a subdomain. You become the company admin, with every module switched on.' },
  { title: 'Bring in your people', body: 'Import your employee list in bulk, or add people one at a time. Departments and job titles come along.' },
  { title: 'Set your rules', body: 'Define leave types, holidays, expense categories and approval workflows, so each request reaches the right person.' },
  { title: 'Run payroll', body: 'Pull in approved time and leave, review the run, lock the period, and export the bank file.' },
];

const MODULES: { icon: LucideIcon; title: string; items: [string, string][] }[] = [
  {
    icon: Users,
    title: 'People',
    items: [
      ['Employees', 'One directory with documents, departments, job titles and an org chart.'],
      ['Recruitment', 'Post roles and move candidates across an applicant board.'],
      ['Pre-boarding', 'Collect signed paperwork from new hires before their first day.'],
      ['Onboarding', 'Task checklists from templates, tracked until each one is done.'],
      ['Offboarding', 'An exit workflow that ends in a final settlement.'],
    ],
  },
  {
    icon: Clock,
    title: 'Time',
    items: [
      ['Time off', 'Leave policies, balances, holidays and approvals, with a calendar of who is out.'],
      ['Time clock', 'Clock in from the browser, or from a biometric terminal.'],
      ['Timesheets', 'Log hours against projects, submit them, and have managers approve.'],
    ],
  },
  {
    icon: Wallet,
    title: 'Pay',
    items: [
      ['Payroll', 'Monthly runs with tax and deductions, locked once approved.'],
      ['Expenses', 'Claims by category, approved by managers, reimbursed through payroll.'],
      ['Loans and advances', 'Requests, approvals, and recovery through payroll.'],
      ['Pay stubs', 'Each employee reads their own payslips, and nobody else&rsquo;s.'],
    ],
  },
  {
    icon: Target,
    title: 'Talent',
    items: [
      ['Performance', 'Review cycles and goals with progress against each one.'],
      ['Reviews and 360s', 'Collect feedback from peers as well as managers.'],
      ['eNPS', 'Short pulse surveys, scored and broken down by team.'],
      ['1-on-1s', 'Shared agendas and notes between a manager and each report.'],
      ['Learning', 'Courses assigned to people, with completion tracked.'],
    ],
  },
  {
    icon: Settings2,
    title: 'Company',
    items: [
      ['Reports', 'Standard reports plus a builder for your own, exportable to a file.'],
      ['Ask MatrixHR', 'Type a question, such as &ldquo;What is my leave balance?&rdquo;, and get an answer.'],
      ['WhatsApp', 'Approve requests from a chat, with consent and an audit trail.'],
      ['Custom fields', 'Add the fields your company tracks that ours do not.'],
      ['Workflows', 'Route requests through the approval steps you define.'],
      ['Audit log', 'Who changed what, and when.'],
    ],
  },
];

const PAYROLL_EXTRAS = [
  { title: 'Expense claims', body: 'Employees file claims by category. Once approved, they are added to the next run as reimbursements.' },
  { title: 'Loans and advances', body: 'Requests are approved in the app, and the balance is recovered through payroll.' },
  { title: 'Final settlement', body: 'When someone leaves, offboarding works out the settlement, including any loan still owed.' },
];

const COMES_IN: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Fingerprint, title: 'Biometric terminals', body: 'ZKTeco devices push punches into attendance.' },
  { icon: FileUp, title: 'Bulk employee import', body: 'Bring your existing list in as one file.' },
  { icon: Clock, title: 'Browser clock-in', body: 'Staff clock in and out from any device.' },
];
const GOES_OUT: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Landmark, title: 'Bank files', body: 'Invalid accounts are left out and listed, so they never ride along.' },
  { icon: FileSpreadsheet, title: 'QuickBooks journal', body: 'Payroll totals exported for your books.' },
  { icon: MessageCircle, title: 'WhatsApp', body: 'Approval requests and one-time codes.' },
  { icon: Webhook, title: 'Webhooks', body: 'Events delivered to your own systems, with retries.' },
];
const BUILD_ON: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Code2, title: 'API keys', body: 'Create scoped keys and call the REST API.' },
  { icon: LogIn, title: 'Single sign-on', body: 'Let people sign in with your identity provider.' },
  { icon: Workflow, title: 'Workflows and custom fields', body: 'Shape approvals and records to fit your company.' },
];

const FAQ = [
  { q: 'Who can see salary and ID numbers?', a: 'HR and admins. Employees see their own record, managers see their reports, and the directory view hides pay, ID and bank fields for everyone below HR.' },
  { q: 'Which countries does payroll cover?', a: 'Payroll engines for Pakistan and the US are built in. Other countries are not calculated yet, so confirm coverage before you commit.' },
  { q: 'How does attendance from biometric devices work?', a: 'ZKTeco terminals push punches to MatrixHR, where they appear next to browser clock-ins. Device credentials are stored encrypted.' },
  { q: 'Can managers approve from their phone?', a: 'Yes. The web app works on a phone, and managers can also approve leave from WhatsApp with a one-time code.' },
  { q: 'What happens when someone leaves?', a: 'Offboarding runs as a workflow with tasks for each team, then produces a final settlement that includes any loan balance still owed.' },
  { q: 'Can employees read their own payslips?', a: 'Yes. Pay stubs in the employee portal show only that person&rsquo;s payslips.' },
  { q: 'Can we connect our own tools?', a: 'Yes. Create API keys, receive webhooks, and set up single sign-on. Approval workflows and custom fields are configured in Settings.' },
  { q: 'How does the trial work?', a: 'Create your company and pick a subdomain. The trial runs for 30 days.' },
];

export default function LandingPage() {
  return (
    <div className="grain relative min-h-dvh">
      <noscript>
        <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <a href="#main" className="skip-link">Skip to content</a>
      <LandingNav />

      <main id="main">
        {/* Hero: asymmetric split, product bleeds off the right edge */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(55% 45% at 80% 10%, hsl(var(--primary) / 0.12), transparent 70%), radial-gradient(40% 40% at 0% 100%, hsl(var(--primary) / 0.08), transparent 70%)',
            }}
          />
          <div className={cn(SECTION, 'relative grid items-center gap-12 pb-20 pt-14 sm:pt-16 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-12 lg:gap-8 lg:pb-16 lg:pt-16')}>
            <div className="stagger lg:col-span-5">
              <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tighter sm:text-5xl xl:text-6xl">
                HR and payroll in one system.
              </h1>
              <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
                MatrixHR runs payroll, attendance, leave and hiring for companies across South Asia and the Middle East.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={primaryCta}>
                  Start free trial
                </Link>
                <a href="#product" className={secondaryCta}>
                  Explore the product
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="relative animate-rise lg:col-span-7 lg:-mr-[14vw]" style={{ animationDelay: '150ms' }}>
              <Frame>
                <Shot name="dashboard" alt="MatrixHR admin dashboard with headcount, pending leave, onboarding and open roles" priority sizes="(min-width: 1024px) 62vw, 100vw" />
              </Frame>
              <Frame className="absolute -bottom-8 -left-4 hidden w-[46%] sm:block lg:-left-14">
                <Shot name="hiring" alt="Applicant tracking board with candidates in each hiring stage" sizes="30vw" />
              </Frame>
            </div>
          </div>
        </section>

        {/* How it works: a timeline, no step numbers */}
        <section id="how" className="scroll-mt-16 border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 py-16 sm:py-20">
          <div className={SECTION}>
            <Reveal>
              <h2 className="max-w-[22ch] font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-4xl">
                From signup to first payslip.
              </h2>
            </Reveal>
            <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {HOW.map((h, i) => (
                <li key={h.title} className="relative border-t border-[hsl(var(--border))] pt-6">
                  <span aria-hidden="true" className="absolute -top-px left-0 h-0.5 w-12 bg-brand-600 dark:bg-brand-400" />
                  <Reveal delay={i * 80}>
                    <h3 className="font-display text-lg font-semibold tracking-tight">{h.title}</h3>
                    <p className="mt-2 text-[hsl(var(--muted-foreground))]">{h.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Product bento: five cells for five jobs */}
        <section id="product" className="scroll-mt-16 py-20 sm:py-28">
          <div className={SECTION}>
            <Reveal>
              <h2 className="max-w-[20ch] font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                Everything HR touches, in one place.
              </h2>
              <p className="mt-5 max-w-[60ch] text-lg text-[hsl(var(--muted-foreground))]">
                Hiring, time off, performance and reporting share one employee record, so nothing is typed twice.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-12">
              {/* A: hiring, tall, tinted */}
              <Reveal className="md:col-span-7 md:row-span-2">
                <article className="relative flex h-full min-h-[26rem] flex-col overflow-hidden rounded-2xl bg-brand-100/70 p-7 dark:bg-brand-900/30 sm:p-9">
                  <Briefcase className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <h3 className="mt-5 font-display text-2xl font-bold tracking-tight">From candidate to first day</h3>
                  <p className="mt-2 max-w-[44ch] text-[hsl(var(--muted-foreground))]">
                    Move applicants across a board, then hand each hire to onboarding with the checklist already built.
                  </p>
                  <div className="relative mt-8 min-h-[16rem] flex-1 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lifted">
                    <Shot name="hiring" alt="Applicant tracking board showing candidates across applied, screening, shortlisted and interview stages" crop zoom={1.35} x={18} y={10} sizes="(min-width: 768px) 55vw, 100vw" />
                  </div>
                </article>
              </Reveal>

              {/* B: leave, plain surface with a cropped screenshot */}
              <Reveal className="md:col-span-5" delay={80}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7">
                  <Users className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <h3 className="mt-4 font-display text-xl font-bold tracking-tight">Time off, decided in one pass</h3>
                  <p className="mt-2 text-[hsl(var(--muted-foreground))]">Requests, balances and who is out today, with approve and reject on the same row.</p>
                  <div className="relative mt-6 h-40 overflow-hidden rounded-lg border border-[hsl(var(--border))]">
                    <Shot name="leave" alt="Leave requests with approve and reject buttons" crop zoom={2.6} x={19} y={19} sizes="(min-width: 768px) 40vw, 100vw" />
                  </div>
                </article>
              </Reveal>

              {/* C: WhatsApp, solid brand fill */}
              <Reveal className="md:col-span-5" delay={160}>
                <article className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-brand-700 p-7 text-white dark:bg-brand-800">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)', backgroundSize: '18px 18px' }}
                  />
                  <MessageCircle className="relative h-6 w-6 text-brand-100" aria-hidden="true" />
                  <div className="relative mt-10">
                    <h3 className="font-display text-xl font-bold tracking-tight">Approve leave from WhatsApp</h3>
                    <p className="mt-2 text-brand-50/90">
                      Managers reply with a one-time code, and every approval lands in the audit log.
                    </p>
                  </div>
                </article>
              </Reveal>

              {/* D: performance */}
              <Reveal className="md:col-span-6">
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                  <div className="p-7 pb-5">
                    <Target className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                    <h3 className="mt-4 font-display text-xl font-bold tracking-tight">Reviews, goals and eNPS</h3>
                    <p className="mt-2 text-[hsl(var(--muted-foreground))]">Run review cycles and 1-on-1s, track goals, and read pulse surveys by team.</p>
                  </div>
                  <div className="relative h-56 overflow-hidden border-t border-[hsl(var(--border))]">
                    <Shot name="performance" alt="Performance page with review cycles and goal progress" crop zoom={1.6} x={19} y={19} sizes="(min-width: 768px) 45vw, 100vw" />
                  </div>
                </article>
              </Reveal>

              {/* E: insights, dotted-grid surface */}
              <Reveal className="md:col-span-6" delay={80}>
                <article
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50"
                  style={{ backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 0)', backgroundSize: '20px 20px' }}
                >
                  <div className="p-7 pb-5">
                    <BarChart3 className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                    <h3 className="mt-4 font-display text-xl font-bold tracking-tight">Numbers leadership can read</h3>
                    <p className="mt-2 text-[hsl(var(--muted-foreground))]">Department splits, joiners and open roles on the home screen, exportable from Reports.</p>
                  </div>
                  <div className="relative h-56 overflow-hidden border-t border-[hsl(var(--border))]">
                    <Shot name="dashboard" alt="Dashboard showing headcount by department" crop zoom={2} x={50} y={24} sizes="(min-width: 768px) 45vw, 100vw" />
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Modules: grouped index, balanced by CSS columns */}
        <section id="modules" className="scroll-mt-16 pb-20 sm:pb-28">
          <div className={SECTION}>
            <Reveal>
              <h2 className="max-w-[20ch] font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                Every module, explained.
              </h2>
              <p className="mt-5 max-w-[60ch] text-lg text-[hsl(var(--muted-foreground))]">
                Here is what each part does, in the words your team will use. Every module is included, and what each person sees depends on their role.
              </p>
            </Reveal>
            <div className="mt-12 gap-x-14 md:columns-2 lg:columns-3">
              {MODULES.map((g) => (
                <Reveal key={g.title} className="mb-12 break-inside-avoid">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300">
                      <g.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-xl font-bold tracking-tight">{g.title}</h3>
                  </div>
                  <dl className="mt-5 space-y-4">
                    {g.items.map(([name, text]) => (
                      <div key={name}>
                        <dt className="font-medium">{name}</dt>
                        <dd className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]" dangerouslySetInnerHTML={{ __html: text }} />
                      </div>
                    ))}
                  </dl>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Payroll: sticky text beside the product */}
        <section id="payroll" className="scroll-mt-16 border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 py-20 sm:py-28">
          <div className={cn(SECTION, 'grid gap-12 lg:grid-cols-12 lg:gap-16')}>
            <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
              <Reveal>
                <h2 className="font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                  A pay run you can check line by line.
                </h2>
                <p className="mt-5 max-w-[52ch] text-lg text-[hsl(var(--muted-foreground))]">
                  Pakistan and US payroll engines calculate tax and deductions. You review the result before anything is paid.
                </p>
              </Reveal>
              <ol className="mt-10 divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
                {PAYROLL_STEPS.map((s, i) => (
                  <li key={s.title}>
                    <Reveal delay={i * 80} className="py-5">
                      <h3 className="font-display text-lg font-semibold tracking-tight">{s.title}</h3>
                      <p className="mt-1 text-[hsl(var(--muted-foreground))]">{s.body}</p>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lg:col-span-7">
              <Reveal delay={120}>
                <Frame>
                  <Shot name="payroll" alt="Payroll runs listed by period with locked, draft and approved status" sizes="(min-width: 1024px) 55vw, 100vw" />
                </Frame>
              </Reveal>
              <Reveal className="mt-12">
                <h3 className="font-display text-xl font-bold tracking-tight">Also handled in the run</h3>
                <dl className="mt-5 space-y-5">
                  {PAYROLL_EXTRAS.map((e) => (
                    <div key={e.title} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-6">
                      <dt className="font-medium">{e.title}</dt>
                      <dd className="text-[hsl(var(--muted-foreground))]">{e.body}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Portals: tabs */}
        <section id="roles" className="scroll-mt-16 py-20 sm:py-28">
          <div className={SECTION}>
            <Reveal>
              <h2 className="max-w-[18ch] font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                Three portals. Everyone sees their own.
              </h2>
            </Reveal>
            <Reveal className="mt-10" delay={80}>
              <RolesTabs />
            </Reveal>
          </div>
        </section>

        {/* Integrations: data flows in, through MatrixHR, and out */}
        <section id="integrations" className="scroll-mt-16 pb-20 sm:pb-28">
          <div className={SECTION}>
            <Reveal>
              <h2 className="max-w-[22ch] font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                Connects to how you already work.
              </h2>
              <p className="mt-5 max-w-[60ch] text-lg text-[hsl(var(--muted-foreground))]">
                Attendance and people data come in, payroll and approvals go out, and you can build on top through the API.
              </p>
            </Reveal>

            <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
              <Reveal>
                <h3 className="font-display text-sm font-semibold text-[hsl(var(--muted-foreground))]">Comes in</h3>
                <ul className="mt-4 space-y-5">
                  {COMES_IN.map((i) => (
                    <IntegrationRow key={i.title} {...i} />
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={80} className="flex items-center justify-center gap-3">
                <ArrowRight className="hidden h-5 w-5 text-brand-700 dark:text-brand-400 lg:block" aria-hidden="true" />
                <ArrowDown className="h-5 w-5 text-brand-700 dark:text-brand-400 lg:hidden" aria-hidden="true" />
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-8 py-6 shadow-lifted">
                  <LogoMark className="h-10 w-10" />
                  <span className="font-display text-base font-bold tracking-tight">MatrixHR</span>
                </div>
                <ArrowRight className="hidden h-5 w-5 text-brand-700 dark:text-brand-400 lg:block" aria-hidden="true" />
                <ArrowDown className="h-5 w-5 text-brand-700 dark:text-brand-400 lg:hidden" aria-hidden="true" />
              </Reveal>

              <Reveal delay={160}>
                <h3 className="font-display text-sm font-semibold text-[hsl(var(--muted-foreground))]">Goes out</h3>
                <ul className="mt-4 space-y-5">
                  {GOES_OUT.map((i) => (
                    <IntegrationRow key={i.title} {...i} />
                  ))}
                </ul>
              </Reveal>
            </div>

            <Reveal className="mt-14 border-t border-[hsl(var(--border))] pt-10">
              <h3 className="font-display text-xl font-bold tracking-tight">Build on top</h3>
              <ul className="mt-6 grid gap-6 sm:grid-cols-3">
                {BUILD_ON.map((i) => (
                  <IntegrationRow key={i.title} {...i} />
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* Security: asymmetric statement + plain grid */}
        <section id="security" className="scroll-mt-16 pb-20 sm:pb-28">
          <div className={SECTION}>
            <div className="rounded-3xl bg-brand-100/60 px-6 py-14 dark:bg-brand-950/70 sm:px-12 sm:py-20">
              <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
                <Reveal className="lg:col-span-5">
                  <h2 className="font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                    One company can never see another&rsquo;s data.
                  </h2>
                  <p className="mt-5 max-w-[46ch] text-lg text-[hsl(var(--muted-foreground))]">
                    Every record belongs to one company. We replay every API route across two companies to prove nothing leaks.
                  </p>
                </Reveal>
                <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:col-span-7">
                  {SECURITY.map((f, i) => (
                    <Reveal key={f.title} delay={(i % 2) * 80}>
                      <div>
                        <f.icon className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                        <h3 className="mt-3 font-display text-base font-semibold tracking-tight">{f.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{f.body}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ: open typographic columns, no accordion */}
        <section id="faq" className="scroll-mt-16 pb-20 sm:pb-28">
          <div className={SECTION}>
            <Reveal>
              <h2 className="max-w-[20ch] font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                Questions HR teams ask.
              </h2>
            </Reveal>
            <div className="mt-12 gap-x-16 md:columns-2">
              {FAQ.map((f) => (
                <Reveal key={f.q} className="mb-9 break-inside-avoid">
                  <h3 className="font-display text-lg font-semibold tracking-tight">{f.q}</h3>
                  <p className="mt-2 leading-relaxed text-[hsl(var(--muted-foreground))]" dangerouslySetInnerHTML={{ __html: f.a }} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="pb-20 sm:pb-28">
          <div className={SECTION}>
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-16 text-white dark:bg-brand-900 sm:px-14 sm:py-20">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '22px 22px' }}
                />
                <Frame className="pointer-events-none absolute -bottom-20 -right-16 hidden w-[46%] border-white/10 lg:block">
                  <Shot name="employee" alt="Employee portal with leave balance, time clock and next holiday" sizes="40vw" />
                </Frame>
                <div className="relative max-w-xl">
                  <h2 className="font-display text-3xl font-bold leading-[1.08] tracking-tighter sm:text-5xl">
                    Run your next payroll on MatrixHR.
                  </h2>
                  <p className="mt-5 text-lg text-brand-50/90">Create your company and invite your team. The trial runs for 30 days.</p>
                  <Link
                    href="/signup"
                    className="mt-9 inline-flex h-12 items-center justify-center whitespace-nowrap rounded-lg bg-white px-6 text-base font-semibold text-brand-900 transition-[background-color,transform] duration-200 hover:bg-brand-50 active:scale-[0.98]"
                  >
                    Start free trial
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[hsl(var(--border))]">
        <div className={cn(SECTION, 'flex flex-col items-start justify-between gap-6 py-10 sm:flex-row sm:items-center')}>
          <Logo markClassName="h-7 w-7" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[hsl(var(--muted-foreground))]">
            <a href="#product" className="hover:text-[hsl(var(--foreground))]">Product</a>
            <a href="#modules" className="hover:text-[hsl(var(--foreground))]">Modules</a>
            <a href="#payroll" className="hover:text-[hsl(var(--foreground))]">Payroll</a>
            <a href="#security" className="hover:text-[hsl(var(--foreground))]">Security</a>
            <a href="#faq" className="hover:text-[hsl(var(--foreground))]">FAQ</a>
            <Link href="/login" className="hover:text-[hsl(var(--foreground))]">Sign in</Link>
          </nav>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">&copy; 2026 MatrixHR</p>
        </div>
      </footer>
    </div>
  );
}
