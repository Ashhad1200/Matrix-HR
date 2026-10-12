# AI assistant + manual payments: Phase 0 audit and plan

Status: **plan only, nothing built.** Audited against `origin/master` @ `3367408`.
Source brief: `MATRIXHR-AI-MANUAL-PAYMENTS-PROMPT.md`. Owner answers "go" to accept every default in section 6.

## 1. What exists today

**Stack.** pnpm/turbo monorepo. `apps/api` is NestJS 10 (REST, `/api/v1`), `apps/web` is Next.js 14, Prisma 5 on PostgreSQL 16.
`apps/api` has no AI SDK and no document-parsing library; it depends on `nodemailer`, `pdfkit`, `@aws-sdk/client-s3`, `@nestjs/throttler`.

**Auth and roles.** JWT (`jwt.strategy.ts` loads the user *and* tenant on every request and rejects non-`ACTIVE` tenants or users).
Roles: `SUPER_ADMIN` (platform operator), `COMPANY_ADMIN`, `HR_MANAGER`, `MANAGER`, `EMPLOYEE`. There is **no "owner" or "finance" role**.
`JwtAuthGuard` is applied per controller, not globally. Controllers gate with `@Roles(...)`; many services take only `tenantId` and trust the controller to have checked the role.

**Tenancy.** Application layer only (`tenantId` on every row, services take it as the first argument; RLS is not wired in). Cross-tenant proof: `pnpm test:isolation` (OpenAPI replay, needs Acme + Globex seeded).

**Billing today** (`entitlements/`, `platform/`):
- `Plan` → `PlanVersion` (**PKR only**: `pricePkrMonthly`, `includedEmployees`, `perEmployeePricePkr`; no currency, no yearly price, no AI credits, no admin-user limit) → `PlanEntitlement` (feature keys).
- `Subscription` (one per tenant): free-text `status` (`trialing|active|past_due|suspended|cancelled|expired`), `renewsAt` (**never written anywhere in code**), no period end, no trial end.
- `EntitlementsService.hasFeature` allows only `active`/`trialing`. A tenant with **no Subscription row** resolves to `unsubscribed`, which denies every feature-gated route. Only 8 routes use `@RequireFeature` (sso, loans, expenses, custom fields, biometric, accounting export, `ai.ask`), so most of the app is not gated at all.
- Backoffice (`/platform/*`, `SUPER_ADMIN` only, `PlatformAuditLog`): list/create tenants, create plans, assign plan, set subscription status, entitlement overrides. The web backoffice has Tenants, Plans, Audit pages.
- **No trial exists.** `AuthService.signUp` creates a tenant with no Subscription. The old landing page and the page I shipped in PR #1 both say "30 days, every module on"; neither is backed by code (see §6, Q3).
- Seeded catalog (`seed-commercial.ts`): starter/growth/pro/enterprise at PKR 5,000/10,000/17,000 base + PKR 250/500/850 per employee. `PRICING_TIERS` in `packages/shared` and the landing page's rate card use the per-employee numbers.

**Payment gateways.** Searched the whole repo (code, docs, env, compose) for paddle, stripe, payfast, jazzcash, easypaisa, safepay, paymob, 2checkout, lemonsqueezy: **zero hits.** There is no Paddle code to keep inert and no tenant-side gateway to hide. `TenantIntegration` is a generic provider row (slack/okta/deel via marketplace), unrelated to payments. Rules 7 and 8 therefore need no code, only a regression test that no gateway setting appears.

**AI today** (`ai/`): `POST /ai/ask` (gated by `ai.ask`, which only the *enterprise* plan has) and `POST /ai/rank-candidate` (ungated). Gemini only, via `GEMINI_API_KEY` env, with keyword/canned fallbacks. No chat history, no uploads, no tools, no credits, no OpenAI/Anthropic. Usage is recorded via `UsageEvent` (`ai.calls`), fire-and-forget.

**Uploads.** `uploads/` writes to S3-compatible MinIO. In production (`docker-compose.deploy.yml`) MinIO has a **named volume** `minio_data`, so objects survive redeploys. But `UploadsService.onModuleInit` sets a **public-read bucket policy** (a documented dev shortcut). Payment proofs must not go there.

**Email.** `mail/mail.service.ts`: nodemailer from a single `SMTP_URL`, `MAIL_FROM`. No outbox, no retry; in production an unconfigured SMTP just logs an error. The brief's `SMTP_HOST/PORT/USER/PASS/FROM` are not read today.

**Deploy.** Coolify, build pack docker-compose (`docker-compose.deploy.yml`: db, minio, api, web). API entrypoint runs **`prisma migrate deploy`** on every start, then `node dist/main.js`. So **schema is applied on startup, from migration files**, which means my change must ship as a migration (not `db push`). `TRUST_PROXY` is already wired (default `1`) and the throttler keys on `req.ip`. Dev/CI use `db push`.

## 2. Problems found that affect the plan

1. **Migration drift.** `migrations/0_init` creates 72 tables; the schema has 76 models. Missing: `ExpenseCategory`, `ExpenseClaim`, `ExpenseItem`, `LoanRequest` (added after `0_init`, never migrated). A fresh DB built by `migrate deploy` would lack them. Production presumably got them another way (`db push` or manual). **I cannot see prod**, so the runbook's schema-diff step must establish the truth before anything runs.
2. **CI never runs on PRs to `master`.** `.github/workflows/ci.yml` triggers on branches `main` and `develop`; the default branch is `master`. I'll widen it to include `master` in this work (one-line change) so the PR is actually checked.
3. **Gating is thin.** "Lapsed → billing-only screen" cannot rely on `@RequireFeature`; it needs a global guard (design below).
4. **Prod tenant data is unknown to me.** Any statement about "real tenants" is deferred to a read-only report in the runbook.

## 3. Design: Phase 2 (manual payments) first, because AI credits depend on it

Built first even though the brief lists AI as Phase 1: "Buy credits" needs the payment flow and the credit ledger needs purchases. Order of work: schema+migration → billing core → email outbox → AI.

**Schema (additive only; one new migration `1_ai_billing`, idempotent via `IF NOT EXISTS` / guarded `DO` blocks):**

| Change | Detail |
|---|---|
| `PlanVersion` +cols (nullable/defaulted) | `currency` (default `'PKR'` so every existing row stays correct), `priceMonthly`, `priceYearly`, `aiCreditsMonthly`, `maxEmployees`, `maxAdminUsers`, `overagePerEmployee`, `isActive` |
| `Subscription` +cols | `currentPeriodEnd`, `trialEndsAt`, `billingPeriod` (`monthly\|yearly`); `renewsAt` left untouched |
| `Tenant` +col | `aiEnabled Boolean @default(true)` |
| New: `PaymentAccount` | TREEVOXA's bank accounts (label, bank, title, IBAN/account, currency, active). **Nothing seeded.** |
| New: `PaymentRequest` | tenant, purpose (`plan\|credit_pack`), plan/pack ref, period, `expectedAmount` + line items (JSON, includes overage line), declared amount/currency, **unique reference**, status, reviewer, reasons, `provisionalUntil`; **partial unique index** on `(tenantId, purpose) WHERE status='PENDING'` enforces one pending request |
| New: `PaymentProof` | `requestId` unique, `mime`, `size`, `sha256`, `data Bytea` (**DB storage**, see §4) |
| New: `Receipt` + `ReceiptCounter` | `TVX-R-YYYY-NNNNNN`, counter row locked with `SELECT … FOR UPDATE` per year |
| New: `BillingSettings` (singleton) | grace days (3), provisional hours (72), reminder days (7,1,0) |
| New: `EmailOutbox` | to, subject, body, status, attempts, `nextAttemptAt`, `lastError`; worker with backoff |
| New: `BillingReminder` | `(subscriptionId, periodEnd, kind)` unique → each reminder sent once |
| New: `AiSettings` (singleton) | master switch (default **off**), provider, per-provider model, encrypted keys (reuses `CredentialCipher`; write-only) |
| New: `AiConversation`, `AiMessage` | per-user history, tenant-scoped |
| New: `AiActionToken` | single-use confirmation: `userId`, `tenantId`, `sha256(payload)`, `expiresAt` (5 min), `usedAt` |
| New: `AiCreditAccount` + `AiCreditLedger` | append-only ledger (`RESERVE/SETTLE/REFUND/GRANT/PURCHASE/MONTHLY`), unique `idempotencyKey`; balance moved by one conditional `UPDATE … WHERE balance >= x` so concurrent calls cannot overspend |
| New: `CreditPack` | Small/Medium/Large from the brief |

`PlanVersion`/`CreditPack` prices use `Decimal(12,2)`; zero or negative prices are rejected at the DTO and by a `CHECK`.
I'll produce the exact SQL as `docs/ai-manual-payments-schema.sql` and a mechanical check that it contains zero `DROP`/`ALTER … TYPE`/`RENAME`.

**Server modules.**
- `billing/` (tenant side, `COMPANY_ADMIN`/`HR_MANAGER`): catalog, create request (amount computed server-side from the catalog + current active-employee count for Business overage), pick account, issue reference, upload proof (magic-byte check for png/jpg/webp/pdf, ≤ 5 MB, one file), history, receipt.
- `platform/billing/` (`SUPER_ADMIN`): To-check queue, history, accounts CRUD, settings, plan editor (extends `PlatformService.createPlan` with an edit path; every change → `PlatformAuditLog`), credit grant + usage per tenant.
- **Approve** = one `$transaction`: `SELECT … FOR UPDATE` the request, no-op if already `APPROVED`, extend `currentPeriodEnd` from `max(now, currentPeriodEnd)` or grant pack credits, write receipt, write ledger, audit. Reject needs a reason and ends provisional access. Idempotency is tested by two concurrent approvals.
- `common/guards/billing-gate.guard.ts`: **global** `APP_GUARD`. `JwtStrategy.validate` already loads the tenant per request, so I extend that include with `subscription` and compute lifecycle there (`ok | due_soon | grace | lapsed | provisional`). Lapsed tenants may only reach `/auth/*`, `/billing/*`, `/health`, `/uploads` (proof only). The web `app-shell` shows a billing-only screen when `/auth/me` reports `lapsed`. Lapse is **computed** (`now > currentPeriodEnd + graceDays`), never stored, and a tenant with no `currentPeriodEnd` never lapses. `SUPER_ADMIN` is exempt.
- Provisional access: 72 h, once per `currentPeriodEnd` (unique `(subscriptionId, periodEnd)` marker), granted on proof upload, revoked on reject.
- Reminders + outbox worker: no `@nestjs/schedule` dependency, so a single in-process interval guarded by a Postgres advisory lock (safe if two API replicas ever run).
- Receipt: server-rendered printable HTML (and print CSS), issuer text in one config file (`billing/issuer.config.ts`) copied verbatim from the brief.
- Banner and lapsed screen in `apps/web`; Billing pages in the backoffice (4 tabs).

## 4. Design: Phase 1 (AI assistant)

- **Provider layer** `ai/providers/{openai,anthropic}.ts` behind one `LlmProvider` interface using plain `fetch` (no new SDK). Master switch, provider, model and keys are read from `AiSettings` **on every request** (no cache). Keys are write-only in the API; responses return only `hasKey: boolean`. Default OpenAI `gpt-4o-mini`.
- **Chat** `POST /ai/chat` (SSE not required for v1; plain JSON), history per user, max 6 tool iterations per message.
- **Files**: text extracted server-side from PDF/docx/xlsx/csv, images passed to the provider as image parts. Needs three small dependencies (`pdf-parse`, `mammoth`, `exceljs`); flagged for approval below. Originals are **not stored**, only extracted text attached to the message.
- **Data questions** are read tools that call existing services with the caller's identity (`Viewer`-style): headcount, attendance, leave balances, pending approvals, payroll totals (HR+ only).
- **Actions** (add employee, apply/approve leave, mark attendance, create expense claim, run payroll *draft*): the model proposes; the server stores an `AiActionToken` bound to user + tenant + `sha256(exact payload)` and returns "AI wants to do X: Confirm / Cancel". `POST /ai/actions/:id/confirm` executes by calling the **existing service method**, so validation and `AuditService` apply. No deletes. Payroll finalisation, salary and bank-detail changes are not in the tool registry at all.
- **Biggest risk, and the mitigation.** Services trust their controllers for role checks, so a tool calling a service directly could bypass `@Roles`. The tool registry therefore declares required roles per tool in one file, enforced before dispatch, with a test that diffs it against the controllers' `@Roles` metadata and an employee-asks-for-others'-salary refusal test. Uploaded-document text is treated as data; since every write needs a human confirmation, injected instructions cannot write anything.
- **Credits.** Price per call = provider cost × 4, 1 credit = $0.01, images = 2,000 tokens, per-model price table in one config file. Reserve before the call (conditional update), settle after with actual usage, refund on failure. 100-credit trial grant on tenant creation; monthly plan credits granted when a period is extended; purchased packs never expire (separate `purchased` vs `monthly` buckets so monthly credits can reset without touching packs). Out of credits → clear message + "Buy credits" opening the Phase 2 flow.
- **Rate limits**: a custom throttler tracker keyed by `userId`, falling back to `req.ip` (correct behind Coolify because `TRUST_PROXY=1` is already set).
- The existing Gemini path is replaced by this layer; `/ai/ask` stays as a thin compatibility route (§6, Q8).

## 5. Test plan (maps to the brief's Verification section)

Jest unit/integration with a mock OpenAI/Anthropic HTTP server; two-tenant script in the style of `scripts/tenant-isolation-test.ts` extended to proofs, receipts, requests, chat history, AI tools; concurrency tests (double approve, double grant, parallel reserve); Playwright for wizard, banner, lapsed screen, queue, receipt with screenshots in `docs/screenshots/`; migration rehearsal on a fresh Postgres from `master`'s schema + seed, applied twice. Anything already failing on `master` is reported as pre-existing.
Note: the API-level suites need the stack (Postgres/Redis/MinIO). I'll bring it up locally in this container; if Docker is unavailable here I'll use the local Postgres binaries and say so.

## 6. Questions (each has a default; "go" accepts all)

1. **Branch.** The brief says `feat/ai-manual-payments`; this session is pinned to `claude/serene-rubin-xa92dj` and may not push elsewhere without your say-so. *Default:* keep working on `claude/serene-rubin-xa92dj` (restarted from latest `master`; PR #1 already merged) and open the PR from it.
2. **Plan catalog.** The brief's plans are Starter/Growth/**Business**, but the DB has starter/growth/**pro**/enterprise, in PKR. *Default:* add a `business` plan; add **USD `PlanVersion` v2** for starter and growth (existing tenants stay on their v1 PKR version until an operator moves them); leave `pro`/`enterprise` untouched. Seeding happens in a separate script the runbook runs **only after** a read-only check shows no real tenant is on a different-currency plan, as the brief requires. AI features (`ai.ask`) are added to all three plans.
3. **Trial.** None exists in code. *Default:* signup creates a `trialing` subscription, 30 days (matches what the site already promises), Growth feature set, 100 AI credits; `currentPeriodEnd = trialEndsAt`. Existing tenants get nothing new and never lapse (no period end). I'll also fix the landing page's trial claim and its PKR rate card to match whatever you decide.
4. **Who can pay.** No owner/finance role. *Default:* `COMPANY_ADMIN` and `HR_MANAGER` can create requests and see billing; everyone else cannot. Banner shown to those two roles.
5. **Currency.** *Default:* catalog and credit packs are USD only. Payment accounts carry a currency; paying in another currency or amount is allowed with a customer-stated reason and a reviewer reason, and no FX conversion is done.
6. **AI price table.** Provider cost needs per-model USD rates. *Default:* a single versioned table in `ai/pricing.config.ts` (gpt-4o-mini, a GPT-4-class model, and Claude Haiku/Sonnet/Opus ids) that I'll fill from current public pricing and mark "verify before launch"; an unknown model is refused rather than billed at a guess.
7. **New dependencies.** `pdf-parse`, `mammoth`, `exceljs` for file extraction. *Default:* approved.
8. **Existing Gemini path.** *Default:* remove Gemini; `rank-candidate` moves onto the new provider layer (metered, falls back to the existing keyword scorer when AI is off).
9. **Business overage basis.** *Default:* count of employees with `status = ACTIVE` at the moment the request is created, shown as its own line and frozen into the request.
10. **Migration drift.** `0_init` lacks 4 expense/loan tables. *Default:* include them in `1_ai_billing` guarded with `CREATE TABLE IF NOT EXISTS` so fresh databases are correct and production (which almost certainly has them) is a no-op; the runbook confirms against the live schema first.

## 7. What I could not verify from here

Production's actual schema, `_prisma_migrations` state, tenant list, plans, currencies and period ends; whether the server's SMTP (Hostinger, port 465) works; real provider API behaviour (tests use a mock server). The runbook (`docs/matrixhr-prod-runbook.md`, written in the build phase) turns each of these into an explicit read-only check for the local agent with SSH.
