# MatrixHR — Full System Explainer
*Source document for video narration, NotebookLM, and sales enablement. Written in plain language; every feature below is built in the product.*

Brand: **MatrixHR** by **TREEVOXA** · matrixhr.treevoxa.com
Market: Pakistan, the Gulf (GCC) and wider South Asia. Payroll tax engines for **Pakistan** and the **United States** today.

---

## 1. The one-sentence idea

**Everything HR does ends up on a payslip.** Attendance, leave, expense claims, loans, allowances and deductions all flow into one monthly payroll run — and MatrixHR shows its working, line by line, so the number at the bottom is one you can defend.

Most companies run HR across five disconnected places: a spreadsheet for employees, a biometric machine for attendance, WhatsApp for leave, a notebook for loans, and an accountant who re-keys all of it into payroll at month-end. Every hand-off is a chance to lose money or trust. MatrixHR replaces that with **one employee record** that every module reads from, so a person's details are typed once and payroll is assembled from live data instead of re-typed from memory.

## 2. Who it is for, and how they each see it

MatrixHR is **multi-tenant** — one installation serves many separate companies, and no company can ever see another's data. Inside a company there are five roles, and each role sees a different product:

- **Company Admin / HR Manager** — the full workspace: people, time, pay, talent, reports, settings.
- **Manager** — their own team: approvals, their reports' leave and performance, team activity, 1-on-1s.
- **Employee** — self-service: their profile, leave, payslips, expenses, learning, their own activity.
- **Super Admin (the operator)** — the *backoffice*, never a company's HR data: creating client companies, plans, payments, platform audit.

The menu each person sees is generated from their role from a single source of truth, and the backend enforces the same rules again — the hidden menu is convenience; the real boundary is in the API.

## 3. The core loop — a payroll run that takes two people to approve

The heart of the product is **maker-checker payroll**. One person prepares the run; a *different* person approves it. MatrixHR will not let the person who prepared a run approve their own work, because the mistakes that cost the most are the ones nobody else looked at.

A run pulls together, for each employee:
- **Base salary** and any **pay components** — allowances, bonuses, arrears and deductions, recurring or one-off, with a start and end month.
- **Attendance** — unpaid days reduce pay, pro-rated to the month.
- **Tax and statutory deductions** — for Pakistan: FBR income-tax slabs, EOBI and provident fund; for the US, its own engine. Rates live in a **rule set versioned by effective date**, so a budget change applies from the day it takes effect and old runs stay correct.
- **Expense reimbursements** and **loan/advance instalments**.

The output: a **payslip PDF** for every employee, a **bank file** (Meezan, HBL or a generic format) to pay everyone at once, and a **QuickBooks journal** for the accounts. Each payslip explains every line. A locked run can be reopened only with a recorded reason.

## 4. The modules, grouped the way the app is

### People
- **Employee records** — one profile per person: documents (stored privately), departments, designations, manager, an org chart. Import your whole team from one file.
- **Departments & designations** — create, rename, nest and import your structure; you cannot delete one while people still sit in it.
- **Recruitment** — post roles, move candidates across an applicant board (ATS), publish a careers feed.
- **Pre-boarding** — collect signed paperwork before day one, through a secure link, with e-signatures.
- **Onboarding** — build checklist templates and start them for a new hire; tasks lock once someone begins.
- **Offboarding** — an exit runs as a workflow with tasks for each team, then produces a **final settlement**: unused leave encashed, any loan balance recovered, the last partial month pro-rated.

### Time
- **Time off (leave)** — define leave types, yearly days, carry-forward and gender rules; everyone gets a balance automatically. Leave counts **working days only** — weekends and public holidays are never deducted, and each company sets its own weekend. Employees can edit or cancel a request while it is still pending.
- **Time clock** — clock in from a browser, a shared **kiosk**, or a **ZKTeco biometric terminal** that pushes punches straight in.
- **Timesheets** — log hours against projects; managers approve them.

### Pay
- **Payroll** — the maker-checker run described above.
- **Pay components** — allowances, bonuses, arrears and deductions per person; every change is in the audit log.
- **Expenses** — claims by category, reimbursed through payroll.
- **Loans & advances** — approved in the app, recovered in instalments, settled at exit.
- **Pay stubs** — each employee reads their own payslips, and nobody else's.

### Talent
- **Performance** — review cycles, goals, and 360° peer feedback.
- **1-on-1s** — a shared agenda between a manager and each report.
- **eNPS** — anonymous pulse surveys, one answer per person, broken down by team.
- **Learning** — assign courses, track enrolment and completion.

### Company
- **Reports** — standard reports plus a builder, exported to a file.
- **AI assistant** — ask questions about your own data; it confirms before it changes anything (see §7).
- **Activity Monitor** — disclosed work-activity monitoring (see §8).
- **Workflows** — approval steps you define, per request type.
- **Custom fields** — the fields your company tracks that the product doesn't by default.
- **Audit log** — who changed what, and when.

## 5. Connected both ways

**Comes in:** ZKTeco punches, browser and kiosk clock-ins, and your employee list as one import file.
**Goes out:** bank files, a QuickBooks journal, WhatsApp messages, and webhooks (signed, with retries) to your own systems. Build on top with scoped **API keys** and **single sign-on (SAML)**. Global hiring is covered through an **Employer-of-Record (EOR)** option, and a **marketplace** lists the integrations.

## 6. WhatsApp approvals

Managers approve leave without opening a laptop. The request arrives on WhatsApp with a **one-time code**; the manager replies with it, the leave is approved, and the balance updates straight away. The codes leave out the characters 0, O, 1 and I so they read cleanly off a screen, each code works once and expires within 24 hours, employees **opt in** before any message is sent (and STOP ends it), the webhook is **signature-verified** so forged messages are ignored, and every approval from chat lands in the audit log like any other.

## 7. The AI assistant

An in-app assistant that answers questions about your own company's data, scoped to what the person asking is allowed to see. It keeps a chat history, accepts file uploads, and — importantly — **confirms before it changes anything**. It will never finalise payroll, change a salary, or change bank details on its own. The operator chooses the model (OpenAI, Claude or Gemini are switchable in the backoffice), and usage runs against a **credits ledger**. On a single-company install there are no credit limits; under a reseller's brand the assistant speaks in that brand's name, never the vendor's.

## 8. Activity Monitor — monitoring you can show your team

Optional, and **off by default**. When a company turns it on, it must first publish a policy. Then each employee installs a small **desktop agent themselves** from their own *My Activity* page, after reading and accepting that policy. The agent shows a **tray icon** the entire time it runs.

It records **time and activity only**: active versus idle time, **counts** of mouse and keyboard events (never which keys, never positions), and the name of the app or website in focus. It **never** records keystrokes, the screen, the clipboard, or the contents of anything. There is no AI reading the logs.

Every employee can open *My Activity* and see exactly what has been collected about them. HR and managers see **daily summaries**, not keystrokes or screens, scoped so a manager only sees their own reports. If an agent is quit or uninstalled and stops reporting during work hours, HR gets an alert — so you learn when monitoring stops without hiding that fact from the person. Raw detail auto-deletes after a short retention; every time someone views another person's data, it is written to the audit log. The Windows agent ships first, with macOS and Linux from the same codebase.

This is a deliberately **disclosed** design. It is built to be shown to the team, not hidden from them — which is also what keeps it on the right side of the law in Pakistan, the Gulf and anywhere with EU staff.

## 9. Security and tenant isolation

The number-one rule is that **one company can never read another company's data.** Every record carries its company, and every database query is scoped to it. To prove it isn't just a claim, a test suite replays **every API route** as a user from a second company and counts anything that comes back as a leak — the build does not pass if a single row crosses.

On top of that: **two-factor sign-in** (authenticator codes with recovery codes), **account lockout** on repeated wrong passwords, **every other session signed out** when a password changes (with refresh-token rotation), **encrypted** bank/device/accounting credentials, **signature-checked** WhatsApp webhooks, **private files** served only through short-lived signed links, and a production server that **refuses to start** on insecure development defaults. Sensitive changes are all in the audit log.

## 10. Pricing, currency and the commercial model

Plans are **Starter, Growth and Business**, each with a monthly and yearly price, plus **AI credit packs**. Pricing is shown **in your currency**: companies in Pakistan are billed in **rupees (PKR)**, everyone else in **US dollars (USD)**, chosen from the country at sign-up. Each plan has a set price in both currencies — there is no live exchange-rate conversion — and payment is by **bank transfer**: the company uploads a proof, the operator approves it, and a numbered receipt is issued. A new company gets a **30-day free trial with 100 AI credits**; if it lapses, the workspace pauses after a short grace period and the data stays safe.

## 11. Two ways to run it

- **White-label, for resellers.** A partner runs MatrixHR under **their own brand** — product name, logo, colours, support address and domain throughout the app, emails and payslips — hosting **many client companies on one server**, creating each client, setting plans, and suspending or reinstating them, all under the partner's brand. Each client stays a fully isolated tenant. The reseller uploads each client's own logo from the backoffice.
- **Single-company mode.** One company runs its own private copy on its own server, with every module on and none of the billing, trial or credit machinery.

## 12. How it's built (for the technical slice of the audience)

A modern monorepo: a **NestJS** API, a **Next.js** web app, an **Expo** mobile app, and **PostgreSQL** through Prisma. Tenant isolation is enforced in the application layer on every query. Database changes ship as **additive, idempotent migrations** rehearsed against production-like databases before release. Quality is held by a large automated suite — hundreds of API, permission, isolation and browser tests, plus unit and integration tests — run on every change. It deploys with Docker; the reference production runs on Coolify at matrixhr.treevoxa.com.

## 13. The thirty-second pitch

MatrixHR is HR and payroll for Pakistan and the Gulf that treats the payslip as the single source of truth. Attendance, leave, expenses, loans and pay components flow into a payroll run that a second person approves, then out as payslips, bank files and accounting entries. It adds the things local teams actually use — WhatsApp approvals, biometric terminals, rupee or dollar billing by bank transfer — plus an AI assistant that asks before it acts, and disclosed, consent-first activity monitoring. Resellers can run the whole thing under their own brand. One record, every module, and a number at the bottom you can defend.
