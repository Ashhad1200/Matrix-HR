# MatrixHR Engineering Delivery Roadmap

**Prepared:** 17 September 2026
**Status:** Draft v1 — sequencing and sizing are estimates pending the validation work in Market Analysis §15
**Supersedes:** `docs/roadmap.md` and `docs/year2-expansion.md` (see §9 — both predate the current codebase and are materially wrong about what exists)

---

## 0. Purpose

`MARKET_ANALYSIS.md` and `CUSTOMER_MANAGED_DATA_PLANE.md` both deliberately stop short of a delivery plan. This document is that plan: what to build, in what order, why that order, and roughly how long each piece takes for the team that actually exists today (see §8).

It does not repeat content already fully specified elsewhere:
- BYOC/Customer Cloud mechanics, data model, and API contracts are fully specified in `CUSTOMER_MANAGED_DATA_PLANE.md`. This document only says *when* that work starts and what it depends on.
- Competitive positioning, pricing rationale, and market segmentation are in `MARKET_ANALYSIS.md`. This document only turns its priority tiers (§13 there) into sequenced phases.

## 1. Current-State Baseline

This is a direct, verified inventory — not a re-statement of the market analysis's gap list — based on hands-on testing of the running system (RBAC matrix, full CRUD passes, and a Playwright E2E suite covering every module with a real UI). Status labels:

- **Working** — real logic, tested end-to-end, no known correctness bugs.
- **Prototype** — functions, but with hardcoded/simplified logic not safe for production financial or compliance use.
- **Stub** — routes and UI exist; the underlying action doesn't do the real thing (e.g. a marketplace "Connect" button that flips a status flag rather than performing OAuth).
- **Missing** — no implementation.

| Area | Status | Evidence |
|---|---|---|
| Auth, JWT, RBAC (5 roles) | Working | 102/102 role×endpoint probe matrix passing; frontend route guard added and verified this session |
| Tenant isolation | Working, app-layer only | Every service method scopes by `tenantId` param; `rls-policies.sql` exists but is **not applied** — no `SET LOCAL app.tenant_id` anywhere in the codebase |
| Employee records, org chart, departments | Working | Full CRUD verified (create/read/update in real browser); no delete route (intentional — HR records aren't hard-deleted) |
| Leave (policies, balances, requests, approve/reject) | Working | Full submit→approve/reject cycle verified live, including balance deduction |
| Attendance (clock in/out, regularization) | Working | Clock in/out state machine verified live |
| Timesheets (projects, entries, approval) | Working, one real gap | Full create/log/delete verified; **no update or delete route for `Project`** once created — can't rename or retire a project key |
| Payroll (run, calculate, approve/lock) | **Prototype** | Runs and produces numbers (verified gross > net, tax/EOBI/PF deducted) but tax rules are hardcoded constants, not effective-dated; no overtime/bonus/loan/arrears inputs; no maker-checker; approval just flips a status string |
| Recruitment (jobs, applications, pipeline, hire) | Working, basic | Full pipeline APPLIED→...→HIRED verified, including real Employee record creation on hire; no requisition approval, interview scheduling, or offer workflow |
| Onboarding | Working (bug fixed this session) | Task completion verified; `OnboardingProgress.status` previously never flipped to `'completed'` even at 100% — fixed |
| Performance (cycles, goals, reviews, 360, 1:1s) | Working, basic | Manager-review create→submit cycle verified live; no calibration, PIP, or competency framework |
| LMS (courses, enrollment, progress) | Working, one RBAC gap fixed | Full enroll→progress→completion cycle verified; course creation had **no role guard at all** (any Employee could publish a mandatory company-wide course) — fixed this session |
| Reporting | **Prototype** | Fixed dashboards work; `ReportDefinition` records save but **do not execute** — no dynamic query/field-catalog engine behind the "report builder" |
| SSO settings page | Config-only | Save/reload verified working, but this persists SAML *configuration* — there is no SAML request/response handling behind it |
| EOR quote calculator | Working, but not what it implies | The cost calculator itself works correctly; there is no actual employer-of-record legal/operational capability behind it |
| Marketplace / integrations | **Stub** | Connect/Sync/Disconnect UI flows work and update DB state (verified live), but there is no real OAuth handshake with any provider — connecting is `status: 'connected'`, not a live integration |
| Webhooks, Custom Fields, Workflows, eNPS, Peer Reviews, Report Definitions, API Keys, 1-on-1s | Working (CRUD only) | All confirmed with a full create→read→update→delete cycle against the live API |
| WhatsApp | **Stub, and unsafe** | Outbound send + message log exist; inbound "approve leave" command is parsed but **does not actually call the approve endpoint** — it's cosmetic. No webhook signature verification. |
| AI ("Ask MatrixHR") | **Broken** | Confirmed live: Gemini API key is invalid, every call fails and falls back to a canned string. No RAG, no citations, no audit. |
| File storage (MinIO/S3) | **Missing entirely** | Confirmed: no multer, no S3/MinIO client library, no upload endpoint anywhere in the API, despite MinIO running in Docker and `.env` fully configured for it. `POST /employees/:id/documents` takes an already-existing URL string — nothing produces that URL. |
| Commercial back office | **MVP working (Phase 1 done)** | Real `Subscription`/`Plan`/`PlanEntitlement` model, an entitlement resolver, and a `SUPER_ADMIN`-only `/platform` operator UI. Enforcement (`EntitlementGuard`) is live but only wired onto 2 of ~35 modules so far — broader retrofit is Phase 6 work. |
| Secrets (integration tokens) | **Insecure** | `TenantIntegration.accessToken`/`refreshToken` are plain `String` columns — no vault, no encryption-at-rest for these specifically. Matters more once Marketplace stops being a stub. |
| Mobile (Expo) | Minimal, untested this cycle | Login, home, clock in/out, leave, manager approvals exist per the app source; not exercised in this delivery cycle — treat as unverified until its own pass |
| Custom roles / configurable permissions | Missing | Five roles are hardcoded in `packages/shared/src/permissions.ts`; no tenant-level customization |
| Multi-company / multi-legal-entity | Missing | One `Tenant` = one legal entity, no hierarchy |

**Read this table before estimating anything below.** Several "Working" items are working *for their current scope* — e.g. Payroll runs correctly for the simple case tested, but §1's Prototype label reflects that the scope itself is incomplete, not that what exists is buggy.

## 2. Sequencing Principles

In priority order, each phase below exists because of one of these rules:

1. **Nothing is sellable without the commercial back office.** A prospect cannot be put on a paid plan today in any way the software enforces. This blocks revenue, not just a feature — it goes first.
2. **Payroll trust is irrecoverable once broken.** A payroll mistake ends a customer relationship (Market Analysis §14.2). Payroll hardening is scheduled early and is not allowed to ship silently as a "prototype" past this roadmap's Phase 2.
3. **Fix what actively lies to a user before adding what's next to it.** The Marketplace "Connect" button and the WhatsApp "approve" command currently *appear* to work and don't. Shipping more surface area on top of a stub compounds the lie. These get fixed or explicitly relabeled before their surrounding areas expand.
4. **BYOC has its own stated prerequisite** (`CUSTOMER_MANAGED_DATA_PLANE.md` §27): a real control plane and entitlement enforcement must exist first, and the document's own recommended first milestone is vendor-hosted database-per-tenant, *not* customer-cloud deployment. BYOC is scheduled only after Phase 1 is live and stable.
5. **Everything gated by plan should be built after the gate exists**, not before. High-priority completeness items (benefits, compensation, multi-company, custom roles) are scheduled after Phase 1 so they ship already metered and entitlement-aware instead of retrofitted later.
6. **Differentiation and mobile parity are schedule-flexible.** They don't block or get blocked by the critical path, so they're explicitly marked as parallelizable if a second contributor (human or agent) is available.

## 3. Concurrent Validation Track (runs alongside Phases 0–2, not its own phase)

Market Analysis §15 — customer discovery interviews, competitive scripted demos, a qualified payroll practitioner's review of the Pakistan rule set, and pricing testing — is business/research work, not engineering, and this roadmap doesn't schedule it as a phase. But two dependencies matter:

- **Phase 2 (Payroll) should not be marked done** until §15.3's practitioner review has happened against the actual implemented rules, not just this document's description of them.
- **Phase 1 (Commercial Back Office)'s price book** should reflect §15.4's pricing validation, not ship hardcoded to the current PEPM guess.

If those validations haven't happened by the time those phases are code-complete, treat the phase as blocked on validation, not shippable-with-caveats.

---

## 4. Phased Delivery Plan

Sizing assumes the delivery model this repo's own `docs/workflow.md` describes — solo founder + AI-assisted implementation cycle — calibrated against this session's observed pace (see §8). Each phase lists **Goal**, **Scope**, **Depends on**, **Exit criteria**, and **Size**.

### Phase 0 — Close the honesty gaps (1–2 weeks) — ✅ DONE (17 Sep 2026)

**Goal:** Nothing in the product should claim to do something it doesn't. This is cheap, high-trust-value, and unblocks nothing being *actively* misleading while the bigger phases are underway.

**Scope:**
- Relabel or gate the AI feature until Phase 5/6 rebuilds it properly — a valid Gemini key alone is not a fix, since there's still no RAG, citations, or audit; at minimum stop presenting fallback text as an answer.
- Relabel Marketplace connectors as "Preview" / disable the Connect action for providers with no real OAuth behind them, rather than letting a customer believe Slack/Deel/etc. are actually syncing.
- Make the WhatsApp inbound "approve" command either actually call the approval endpoint or stop claiming to — currently it parses the message and does nothing.
- Add the missing `PATCH`/`DELETE` routes for `TimesheetProject` (small, isolated, already surfaced as a real gap this session).
- Decide file storage now, even minimally: either wire a real multer→S3/MinIO upload endpoint for employee documents (small — MinIO is already running, this is one controller + one service), or remove the `fileUrl` field from the UI until Phase 6 builds it properly. Don't leave a form that silently expects a URL nobody can produce.

**Depends on:** nothing.

**Exit criteria:** Every UI action either does the real thing or is visibly marked as not-yet-available. No stub presents as complete.

**Size:** 1–2 weeks.

---

### Phase 1 — Commercial Back Office MVP (4–6 weeks) — ✅ DONE (17 Sep 2026)

**Delivered:** `ProductFeature`/`Plan`/`PlanVersion`/`PlanEntitlement`/`Subscription`/`SubscriptionItem`/`EntitlementOverride`/`UsageEvent`/`PlatformAuditLog` schema; `EntitlementsService` resolver + `EntitlementGuard`/`@RequireFeature()` enforcement (applied to SSO and Custom Fields as the proof slice — broader retrofit across the other ~33 modules is follow-on work, not blocking); `/auth/me` returns resolved entitlements; usage metering wired into employee creation, WhatsApp sends, and AI calls; a `SUPER_ADMIN`-only `/platform` API + UI (tenant list, tenant detail, plan assignment, status control, entitlement overrides with create/delete, audit log) — SUPER_ADMIN now has its own nav entry distinct from COMPANY_ADMIN. Four demo plans seeded (Starter/Growth/Pro/Enterprise) with Acme on Enterprise so no existing functionality regressed. Verified live: downgrading a plan actually returns 403 on a gated endpoint, an override re-grants a single feature despite the plan, and everything is audit-logged. Billing/invoicing remains manual (`Subscription.status` set by a platform operator), as scoped.

**Not done / explicitly deferred to Phase 6:** entitlement gating on the other ~33 modules (only SSO + Custom Fields are gated today, as the proof-of-concept); frontend doesn't yet hide nav items by entitlement (only by role); no self-serve signup→plan flow.

**Goal:** Make `Tenant.plan` mean something. This is the single most important unblock in the entire roadmap — per Market Analysis §11.1, changing it today has zero effect.

**Scope:**
- Data model: `ProductFeature`, `Plan`, `PlanVersion`, `PlanEntitlement`, `Subscription`, `SubscriptionItem`, `EntitlementOverride`, `UsageEvent` (see Market Analysis §11.3 for the full entity list — implement at least these first six; `Invoice`/`Payment`/`Credit` can be manual/offline for the first version, see below).
- Entitlement resolver: combines plan + add-ons + overrides into a resolved capability set per tenant.
- Enforcement: API guards check resolved entitlements (not just role); `/auth/me` returns entitlements alongside permissions; frontend nav/actions respect both.
- Billing: **manual/offline for v1** — an admin marks a subscription active/past-due by hand. Full invoicing/payment-provider integration is not required to unblock selling; it's a later add-on once there are paying customers to justify it.
- Minimal platform-operator screens: tenant list, tenant detail, plan assignment, entitlement override with reason/audit.
- Usage metering: start with the handful of things already worth limiting — active employees, WhatsApp messages, AI calls — recorded as `UsageEvent`s even before anything acts on them.

**Depends on:** nothing blocking (can start immediately, in parallel with Phase 0).

**Exit criteria:** Assigning a tenant a different plan visibly changes what that tenant's users can do and see, enforced server-side, not just hidden in the sidebar. A platform operator (distinct from `COMPANY_ADMIN`) can view and manage this without touching the database directly.

**Size:** 4–6 weeks. This is the largest single phase before Phase 2 and the one most worth not rushing — it's the foundation every later "gate this by plan" requirement in Phase 6 depends on.

---

### Phase 2 — Payroll Production Hardening (4–6 weeks) — ⚠️ CODE DONE (18 Sep 2026), NOT SIGNED OFF

**Goal:** Move payroll from "produces plausible numbers" to "a controlled financial system," per Market Analysis §7.5 and §14.2.

**Scope:**
- ✅ Effective-dated compliance rules: tax brackets, EOBI, provident fund rates now versioned via `PayrollRuleSet` (fiscal year / effective date), not hardcoded constants. Seeded with the same values that were previously hardcoded, so today's numbers are unchanged.
- ✅ Configurable recurring earnings/deductions per employee (`CompensationItem`: allowances, loans, advances, bonus, arrears — recurring or period-bound).
- ✅ Attendance wired into the calculation: absent/half-day records within the period pro-rate base salary before tax.
- ✅ Maker-checker: `submit` / `approve` / `lock` / `reopen` lifecycle, with the API rejecting approval when the approver is the same user who prepared the run, and reopen requiring a reason.
- ✅ Generated, archived PDF pay slips (pdfkit, stored in MinIO, served on demand) replacing the old raw-data stub.
- ⬜ Offboarding-linked final settlement calculation — still deferred to Phase 3 as originally scoped.
- ⬜ HBL/Meezan bank-file strings are still unvalidated against real bank format specs — `generateBankFile()` now explicitly returns `validated: false` rather than implying correctness, but the underlying format itself wasn't touched this phase.

**Depends on:** Phase 0 (no hard dependency, but do this after the honesty pass so the "prototype" label is still accurate while work is in progress).

**Exit criteria:** A qualified Pakistan payroll practitioner (§15.3 validation) reviews the implemented rules against real FBR/EOBI/PF requirements and signs off. **That review has not happened** — the code above is regression-tested (unit + RBAC + API + e2e, all green) and functionally complete against this phase's scope, but the tax/EOBI/PF *values* themselves are unaudited by a human practitioner. Keep the "prototype" label on payroll compliance specifically until that review happens, regardless of how complete the code looks.

**Size:** 4–6 weeks engineering + practitioner review time (external dependency, don't estimate that part).

---

### Phase 3 — Offboarding & Executable Workflow Engine (3–4 weeks) — ✅ DONE (18 Sep 2026)

**Goal:** Two related critical gaps from Market Analysis §7.7 and the Feature Gap Matrix (§8): there is no offboarding flow at all, and "workflow definitions exist" but nothing executes them.

**Scope:**
- Resignation → clearance checklist → exit interview → access removal → final settlement (reuses Phase 2's settlement calculation).
- A real execution engine behind the existing `Workflow`/`WorkflowInstance` models — currently these are CRUD records with no runtime that actually walks steps, notifies approvers, or advances state. Leave, expenses (Phase 6), and offboarding approvals should all route through this one engine rather than each module reimplementing its own approve/reject.

**Built:** `WorkflowEngineService` executes tenant-configurable `WorkflowDefinition` steps (falls back to built-in defaults per trigger): role-rank authorization per step, direct-manager check for MANAGER steps, segregation of duties (requester can never act on their own request), an atomic step transition so concurrent approvers can't double-fire, a per-step audit trail (`WorkflowStepAction`), and per-entity handlers. Leave approvals (including the WhatsApp APPROVE/REJECT path) now run on it — which also fixed a latent bug where an already-approved leave request could be approved/rejected again and double-adjust balances. `OffboardingModule`: resignation/termination → approval chain → 4-item clearance checklist → exit interview → final settlement (reuses the payroll engine, rules and attendance inputs; pro-rata final month, annual-leave encashment at base/30, loan/advance recovery) → COMPANY_ADMIN sign-off that closes the employee record, writes employment history, deactivates the user and kills their sessions. Web UI at `/offboarding` (built by Codex CLI) adapts to employee / manager / HR / admin.

**Known limits (be honest with customers):** settlement is flagged `validated: false` — gratuity, notice-period shortfall/recovery and outstanding loan *balances* (only the current-period installment) are not modelled and it needs the same practitioner review as Phase 2; the clearance checklist is a fixed template (not yet tenant-editable); the older `PATCH /employees/:id {status: TERMINATED}` path still exists and bypasses offboarding (deliberate emergency path — consider gating it in Phase 5); only leave and offboarding use the engine so far (expenses join in Phase 6).

**Depends on:** Phase 2 (final settlement math).

**Exit criteria:** A resignation initiated in the UI produces a completed clearance record, a final settlement figure, and a closed employee record without manual database intervention. At least one other approval flow (leave) is migrated onto the shared engine as proof it's actually reusable, not offboarding-specific.

**Size:** 3–4 weeks.

---

### Phase 4 — Make Integrations Real (3–4 weeks) — ✅ CODE DONE (18 Sep 2026), exit criteria PARTLY met

**Goal:** Turn at least the highest-value stubs from Phase 0's relabeling into actual working integrations, per Market Analysis §7.14 and §9.4.

**Scope:**
- Encrypted secret storage for `TenantIntegration.accessToken`/`refreshToken` (currently plaintext columns — fix this regardless of which providers get built first).
- Pick 2–3 integrations to actually build, prioritized by the target segment: one accounting export (QuickBooks or a local equivalent), one biometric device sync (ZKTeco, per `docs/year2-expansion.md`'s own marketplace phase 1), one bank file consumer/producer validated against Phase 2's output.
- Webhook delivery retry, failure queue, and a visible health status per integration.
- Honest catalog status for everything not yet built: "Available," "Beta," "Planned," "Partner-provided" — no unlabeled "Connect" button for something with nothing behind it.

**Built:** (1) `TenantIntegration` tokens and webhook signing secrets are AES-256-GCM encrypted at rest (`CredentialCipherService`, key from `CREDENTIAL_KEY`; production refuses to boot without it; legacy plaintext rows are migrated on startup) and are never returned by the API. (2) Webhooks: HMAC-SHA256 signatures (`X-Webhook-Signature` over `timestamp.body` — the secret is no longer sent as a header), persisted retries with backoff (1m/5m/30m/2h/6h, 6 attempts), a failure queue with manual redelivery, per-webhook health (healthy/degraded/failing/disabled, auto-disable after 15 consecutive failures), and an SSRF guard on tenant-supplied URLs. (3) `IntegrationSyncLog` — every push/export is recorded (direction, processed/failed counts, message) and surfaced in the Marketplace. (4) Catalog honesty: every app is `available`/`beta`/`planned`; 20 of 22 were stubs and are now `planned` and cannot be connected; the fake "Sync Now" counter was deleted. (5) **ZKTeco ADMS receiver** (beta): registered terminals push punches to `/iclock/cdata`; they become idempotent `BIOMETRIC` attendance records (device time converted from the tenant timezone), unmatched PINs/garbage lines are counted and shown in the sync log. Employees now have an optional `biometricPin`. (6) **QuickBooks journal export** (beta): a balanced payroll journal CSV for approved/locked runs, plan-gated (`accounting.export`, Growth+), logged as an outbound run. (7) **Bank-file validation**: PK IBAN mod-97 check, duplicate/zero-net detection; invalid rows are left out of the file and reported. Seed IBANs were 20 chars (invalid) and are now valid.

**Not met / known limits:** the exit criterion asks for real data "in both directions" — ZKTeco is inbound-only (no server→device commands) and QuickBooks is a file export, not an API/OAuth connection, so no single integration is bidirectional yet. ZKTeco is verified against the ADMS protocol shape with simulated pushes, **not against physical terminals**; its only authentication is the registered serial number (inherent to the protocol). The QuickBooks CSV column layout follows QBO's journal-import template but has not been imported into a real QuickBooks company. Bank-file *data* is validated; the HBL/Meezan *column layouts* remain unconfirmed by the banks (`validated: false`). No OAuth flows exist yet (encrypted storage is ready for them); there is no credential key-rotation tool; the SSRF guard resolves DNS separately from the request (rebinding is theoretically possible); the webhook worker is an in-process poller, not a queue.

**Depends on:** Phase 1 (gating integrations by plan — e.g. accounting export as a Growth+ feature).

**Exit criteria:** At least one integration moves real data in both directions with a customer-visible sync log and error state, not just a connected/disconnected flag.

**Size:** 3–4 weeks for the first two integrations; each additional integration is roughly 1–2 weeks once the OAuth/secret/retry scaffolding from the first one exists.

---

### Phase 5 — Security, Audit, and Safe WhatsApp (2–3 weeks) — ✅ DONE for the roadmap scope (18 Sep 2026); hardening limits below

**Goal:** Close the multi-tenant isolation risk (§14.6) and make WhatsApp actually safe to expand (§7.13, §14.5-adjacent).

**Scope:**
- Either activate the existing `rls-policies.sql` with a real `SET LOCAL app.tenant_id` per request, or build and run a systematic tenant-isolation test suite that proves the application-layer scoping is airtight (do at least one of these — don't leave RLS as dead SQL indefinitely).
- Complete the MFA enrollment/recovery flow (schema fields already exist, unused).
- WhatsApp webhook signature verification (currently unverified — a documented gap from this session and from §7.13).
- Make the inbound approve/reject command actually execute against the Phase 3 workflow engine, with a short-lived signed action token rather than trusting the raw message content.
- Opt-in/opt-out and consent tracking for WhatsApp messaging.

**Chosen approach for isolation:** RLS is still *not* active. The scope item allowed "RLS **or** a systematic proof", and this phase built the proof: `pnpm test:isolation` discovers every route from the OpenAPI document, harvests both tenants' ids across admin/manager/employee, replays each tenant's ids against every id-addressed route from the other tenant (132 replays, including mutations), and scans every response for the other tenant's ids or `tenantId`. It passes. It has limits: it can only replay routes for which a tenant has data (7 id-routes had none and were reviewed by reading the code instead), and it cannot prove the absence of a bug in a path it doesn't reach — RLS remains worthwhile defence-in-depth (Phase 9).

**Real vulnerabilities found and fixed while building it** (none were known before this phase):
- `POST /whatsapp/webhook` was **unauthenticated** and accepted `{tenantId, from, text}` — anyone could approve a leave request as a manager by spoofing their phone number.
- Any employee could read **every colleague's salary, CNIC, bank account/IBAN, NTN, DOB and addresses** (`GET /employees`), plus everyone's leave requests, onboarding and goals.
- The performance controller had **no role guards**: any employee could create review cycles/reviews and edit anyone's goals/reviews, including other tenants' by id. `lms.updateProgress`, `lms.enroll` and `onboarding.completeTask` trusted bare ids with no tenant or owner check.
- Untyped request bodies let callers **override `tenantId`** on departments/designations/courses/jobs/applications; client-supplied foreign keys (manager, department, policy, cycle, job, course…) were never checked against the tenant.
- `POST /dev/seed-bulk` was unauthenticated and always loaded.
- `GET /auth/me` returned the caller's **bcrypt hash and 2FA secret**; refresh-token "hashes" were bcrypt over a JWT (only the first 72 bytes, identical for every token of a user), so any refresh token matched any session; refresh tokens never rotated; a new tenant's refresh token could never be redeemed; deactivated users could still log in.

**Built:** authorization/visibility helpers (`common/data-scope.ts`: directory vs full employee view, self/reports/HR row scoping, tenant-reference checks) and validated DTOs on every write route; auth hardening — TOTP MFA (RFC 6238 vectors tested; secret encrypted at rest; recovery codes hashed; replay-proof; wrong codes count toward lockout), password reset (30 min, single-use, hashed, revokes sessions and access tokens via `tokenVersion`), change-password, refresh rotation, logout, per-route rate limits (login 10/min, reset/forgot/signup 5–10/min, verified on an instance without test overrides); **WhatsApp**: Meta HMAC signature verification over the raw body, subscription handshake, tenant resolved from the business number, exact-match sender identity, **one-time 8-character approval codes bound to the approver, 24 h expiry, single use** (a raw request id is not accepted), consent/opt-in gating with STOP/START and self-service + HR-attested consent, message-id dedup, audit-trail entries; operations — production config guard (refuses to boot on dev defaults), CORS allow-list, error filter (no stack/Prisma leakage, request ids), structured JSON access logs, `/health` + `/health/ready`, API docs off in production, security headers on the web app, error pages, token refresh in the web client, targeted DB indexes, a **verified baseline Prisma migration**, and `docs/DEPLOYMENT.md` + `docs/OPERATIONS.md`.

**Known limits (be honest with customers):** the web app still keeps tokens in `localStorage` (an XSS could steal a session) and has no strict `script-src` CSP; MFA is opt-in per user (no enforce-for-admins policy, no QR image, not applied to SSO logins); rate-limit counters are per process (need Redis with multiple replicas); password-reset email is verified only against the dev outbox, not a real SMTP server; the WhatsApp flow is verified with signed simulated webhooks, **not against Meta's live API**; because consent is required, WhatsApp approval requests to managers are logged as `blocked_no_consent` until each manager opts in (HR can attest consent at `PUT /whatsapp/consents`); blue-green is a documented runbook, not provisioned or rehearsed infrastructure; the `Session` table is never pruned and there is no credential-key rotation tool.

**Depends on:** Phase 3 (workflow engine for the WhatsApp action to call into).

**Exit criteria:** A tenant-isolation test suite exists and passes (or RLS is live and equally proven); a WhatsApp message can approve a real leave request end-to-end with signature verification and an audit trail.

**Size:** 2–3 weeks.

---

### Phase 6 — High-Priority Product Completeness (6–8 weeks, parallelizable into sub-tracks)

**Goal:** Close the "High" tier of the Feature Gap Matrix (§8) now that Phase 1's entitlement system exists to gate all of it correctly from day one.

**Scope (each bullet is a roughly independent sub-track if more than one contributor is available):**
- Benefits and dependents (plans, eligibility, enrollment).
- Compensation structures (bands, cycles, connects to Payroll's recurring-earnings model from Phase 2).
- Expenses, reimbursements, loans, advances (feeds Payroll).
- Shift assignment, overtime rules, attendance-to-payroll reconciliation.
- Recruitment: requisition approval, interview scheduling, scorecards, offer generation (extends the working pipeline from §1).
- Dynamic reporting engine — the field catalog, filter/grouping, and query execution the current `ReportDefinition` records don't have yet.
- Custom roles and configurable permissions (replaces the hardcoded five-role model in `permissions.ts` — sequence this carefully, it's the same file the frontend nav and every `RolesGuard` depend on).
- Multi-company/multi-legal-entity support.
- File storage done properly (documents, resumes, pay slips, exports through one storage adapter — Phase 0 may have shipped a minimal version; this is the complete one with lifecycle/expiry).

**Depends on:** Phase 1 (entitlement gating), Phase 2 (compensation/expenses touch payroll).

**Exit criteria:** Each sub-track has its own exit bar; treat this phase as done when the Feature Gap Matrix's "High" row for that capability moves from Missing/Basic to Present.

**Size:** 6–8 weeks if sequential; meaningfully compressible with parallel contributors since the sub-tracks mostly don't share files.

---

### Phase 7 — Software-House Differentiation (4–6 weeks, schedule-flexible)

**Goal:** Build the pillar the market analysis identifies as MatrixHR's strongest wedge (§10.3 Pillar 2) on top of the already-working Timesheets module.

**Scope:**
- Clients, contracts, billing rates, cost rates on top of the existing `Project`/`TimeEntry` models.
- Utilization, bench, and capacity reporting.
- Skills matrix and staffing search.
- Project budget vs. actual reporting.

**Depends on:** Nothing blocking. This can move earlier than Phase 6 if competitive pressure justifies it — it's explicitly not on the critical path.

**Size:** 4–6 weeks.

---

### Phase 8 — Mobile Parity (4–6 weeks, parallelizable with Phase 6/7)

**Goal:** Close the mobile gap in §7.15. Most of the backend API surface already exists (confirmed extensively this session for web); this is primarily client work.

**Scope:** Profile/documents, pay slips, notifications, timesheets, expenses, onboarding tasks, goals/reviews/learning, manager team/attendance/approvals, offline-aware field attendance, push notifications.

**Depends on:** Whichever backend features it's surfacing (e.g. can't show expenses on mobile before Phase 6 builds expenses).

**Size:** 4–6 weeks, largely independent of the phases above once their APIs exist — good candidate for a second contributor track.

---

### Phase 9 — Vendor-Hosted Database-per-Tenant (3–4 weeks)

**Goal:** `CUSTOMER_MANAGED_DATA_PLANE.md`'s own recommended first milestone (§2.3, §31) — before any customer-cloud work, prove tenant routing, migration orchestration, and isolation with MatrixHR still operating the infrastructure.

**Scope:** See `CUSTOMER_MANAGED_DATA_PLANE.md` §4.2 and §25 directly — this phase *is* that document's "vendor-hosted dedicated database" model. Don't re-derive it here.

**Depends on:** Phase 1 (control plane/entitlements must exist first — `CUSTOMER_MANAGED_DATA_PLANE.md` §27 is explicit about this), Phase 5 (security baseline).

**Exit criteria:** `CUSTOMER_MANAGED_DATA_PLANE.md` §24's acceptance criteria, scoped to the vendor-hosted (not BYOC) model.

**Size:** 3–4 weeks.

---

### Phase 10 — Customer Cloud / BYOC (6–10 weeks)

**Goal:** The full model in `CUSTOMER_MANAGED_DATA_PLANE.md`. Do not start this phase without Phase 9 proven in production with at least one real dedicated-database tenant.

**Scope:** The entire `CUSTOMER_MANAGED_DATA_PLANE.md` document — control-plane/data-plane split, management agent, provisioning lifecycle, release orchestration. Not re-specified here.

**Depends on:** Phase 9, live and stable.

**Size:** 6–10 weeks for the first customer; each subsequent customer should cost meaningfully less once the standardized data-plane package (§25.2 there) is proven.

---

### Phase 11 — GCC Localization: UAE, then Saudi (6–10 weeks each)

**Goal:** Market Analysis §13's "Later strategic expansion" — but only after the Pakistan product and commercial back office are proven with paying customers, per §16's Final Assessment.

**Scope (UAE first):** Arabic RTL, AED price book (Phase 1's multi-currency support), WPS file generation, UAE labor-law leave/holiday rules, end-of-service gratuity calculation, local support hire.

**Scope (Saudi, after UAE):** SAR price book, GOSI contributions, Saudization/Nitaqat reporting, enterprise SAML SSO (finally completing the config-only SSO settings page from §1).

**Depends on:** Phase 1 (price books need to support non-PKR currency and region-specific tax config from day one — retrofitting this later is expensive), Phase 2's payroll architecture being genuinely rule-versioned and extensible to a second country, not Pakistan-specific in its bones.

**Size:** 6–10 weeks each, and each is genuinely a new localized product per Market Analysis §14.8 — don't compress this estimate on the assumption that "it's just currency and language."

---

## 5. Dependency Graph

```
Phase 0 (honesty pass) ──────────────┐
                                      │
Phase 1 (commercial back office) ────┼──> Phase 4 (real integrations)
        │                            │
        ├──> Phase 6 (high-priority) │
        │         │                  │
        │         └──> Phase 8 (mobile, partial)
        │
Phase 2 (payroll hardening) ──> Phase 3 (offboarding + workflow engine) ──> Phase 5 (security + WhatsApp)
        │                                                                        │
        └──> Phase 6 (compensation/expenses sub-tracks)                         │
                                                                                  │
Phase 1 + Phase 5 ──────────────────────────────────────────────> Phase 9 (dedicated DB) ──> Phase 10 (BYOC)

Phase 7 (software-house differentiation) — independent, schedule anywhere after Phase 0
Phase 1 + Phase 2 (extensible rules) ──> Phase 11 (GCC localization)
```

## 6. Rough Timeline Summary

| Phase | Size | Cumulative (sequential) |
|---|---|---|
| 0 — Honesty pass | 1–2 wk | 1–2 wk |
| 1 — Commercial back office | 4–6 wk | 5–8 wk |
| 2 — Payroll hardening | 4–6 wk | 9–14 wk |
| 3 — Offboarding + workflow engine | 3–4 wk | 12–18 wk |
| 4 — Real integrations | 3–4 wk | 15–22 wk |
| 5 — Security + WhatsApp safety | 2–3 wk | 17–25 wk |
| 6 — High-priority completeness | 6–8 wk | 23–33 wk |
| 9 — Dedicated database per tenant | 3–4 wk | 26–37 wk |
| 10 — BYOC (first customer) | 6–10 wk | 32–47 wk |
| **Critical path total** | | **~8–11 months** |
| 7 — Software-house differentiation | 4–6 wk | parallel, doesn't extend critical path |
| 8 — Mobile parity | 4–6 wk | parallel, doesn't extend critical path |
| 11 — UAE, then Saudi | 6–10 wk each | starts after critical path, sequential per country |

This is a single-track estimate. Every phase marked "parallelizable" in §4 compresses the wall-clock total if a second contributor (human or additional AI agent workstream) picks it up — Phases 6, 7, and 8 in particular have sub-tracks that don't touch the same files.

## 7. Explicit Non-Goals of This Roadmap

Deferred deliberately, not forgotten — these are Market Analysis §13's "Later strategic expansion" items beyond GCC, and shouldn't be scheduled before the critical path above is real:

- Workforce planning and scenario forecasting.
- Succession planning and internal mobility.
- Advanced learning (SCORM/xAPI, certifications, learning paths).
- General engagement/recognition platform beyond eNPS.
- HR service desk and knowledge base.
- Bangladesh, Qatar, Egypt (Year 3 per the existing `docs/roadmap.md` timeline — revisit only after UAE and Saudi are live).
- Full self-managed/on-premises deployment (`CUSTOMER_MANAGED_DATA_PLANE.md` §5.1 — "consider later only," after BYOC is proven).

## 8. Sizing Methodology and Assumptions

Estimates assume the delivery model already described in `docs/workflow.md` — a solo founder working in an AI-assisted cycle, not a staffed team. That assumption is calibrated against this session's directly observed pace: in one extended session, a full Docker environment stand-up, an RBAC/CRUD test framework, 18 Playwright E2E specs across nine modules, and five real bug fixes (route-guard bypass, a DTO validation bug, an onboarding status bug, an LMS RBAC gap, plus the Docker/dev-environment fixes) were completed. Phase sizes above scale that kind of throughput to features requiring new schema, new UI, and cross-module wiring, which take longer per unit than test-writing and bug-fixing did.

If `docs/year2-expansion.md`'s pod structure (hiring triggers at 20+, 30+, 50+, 100+ tenants) is activated earlier than that document assumes, every phase from 4 onward compresses proportionally to the number of parallel contributors, per the parallelization notes in §4 and §6.

Treat every size in this document as **rough** until a phase is actually underway — the point of estimating at this level is sequencing and dependency clarity, not commitment-grade scheduling. Re-estimate each phase at its start based on what the previous phase actually revealed.

## 9. Disposition of Existing Roadmap Documents

`docs/roadmap.md` and `docs/year2-expansion.md` predate the current codebase and are now actively misleading:

- `docs/roadmap.md` lists Payroll, ATS, Performance, LMS, AI, Marketplace, and SSO under **"Defer"** — all of these already exist in the codebase today (see §1's baseline), several with real working end-to-end flows. Its quarterly milestones no longer reflect reality.
- `docs/year2-expansion.md`'s pod structure and GTM timeline may still be directionally useful for *when to hire*, but its module-to-pod mapping assumes the pre-build state.

Recommendation: don't delete either file (they're useful history of original intent), but add a short note atop each pointing here, and stop treating their timelines as current. This document is the one to update as phases complete.
