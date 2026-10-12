# CRUD test report (client handover)

Run: 2026-10-12, local stack only (Postgres 127.0.0.1:5433 `matrixhr`, API :3001, web :3000 as a **production build**; two fresh tenants `ZZ-TEST-A` / `ZZ-TEST-B`, one user per role).
Suite: `tests/qa-crud/` (run with `pnpm test:qa`). Inventory: `docs/qa/crud-matrix.md`. Accounts: `docs/qa/test-accounts.md`. Screenshots: `docs/qa/screenshots/` (121).

## 1. Verdict
✅ **Ready for the client demo, with the caveats in section 5.** Everything the proposal promises has a working screen, and every create/read/update/delete, approval chain, permission and isolation check passes. Round 2 (this update) added the owner's five decisions and the missing screens; round 1's 20 bugs are all fixed.

## 2. Totals
| | Round 1 | Round 2 (after the owner's decisions) |
|---|---|---|
| Automated specs (`pnpm test:qa`) | 103 / 103 | 130 / 130 pass in round 2; **158 / 158 pass after round 4** (19 new in round 3, 9 more for currencies: structure, pay components, client logo, white-label API and web) |
| Route matrix | 292 routes | 298 routes: 401 without a token everywhere; 403 for every non-listed role on every role-gated route; tenant B sees no tenant A row; the 24 public routes are exactly the intended ones |
| Browser journeys | billing, AI | billing (staff logins, leave setup, private files, payments) passes; AI assistant passes (22 checks) |
| API unit + DB integration | 153 | 160 pass after round 3 (7 new brand/receipt/payslip-PDF tests) |
| Migration rehearsal | 5 prod-like databases | still 5 databases, now with 3 migrations (`0_init`, `1_ai_billing`, `2_hr_modules`): ALL PASSED, applied twice each, row fingerprints unchanged |
| Bugs found | 20 (1 blocker, 9 major, 10 minor), all fixed | no new product bugs found by the extended suite; one test race fixed (below) |

**The billing-journey "flake" is explained.** After a lapsed company sends payment proof it gets temporary access straight away, so the billing-only screen is replaced by the app within a moment. The journey asserted a message on the screen that disappears as that happens. That was a race in the test, not a product defect: a dedicated loop (4 signup, lapse, upload runs through the real UI) landed on the dashboard with a valid session every time. The journey now waits for the temporary-access banner instead, and passed 4 of 4 runs.

## 3. Matrix (C / R / U / D / actions)
✅ verified by test · 🔧 fixed during this run · ⛔ not in the UI (API exists) · — operation does not exist
| Entity | C | R | U | D | Other actions | UI |
|---|---|---|---|---|---|---|
| Employee | ✅ UI+API | ✅ list/search/pagination 🔧/detail | ✅ API (list has no edit; detail page) | — by design (offboarding) | CSV import ✅ API, documents ✅ | ✅ |
| Department / designation | ✅ 🔧 (empty name) | ✅ | — | — | | ⛔ (no screen) |
| Staff login (invite) | ✅ UI+API | ✅ | resend ✅ | revoke ✅ | accept ✅ (journey) | ✅ |
| Leave request | ✅ UI+API 🔧 (errors now shown; working days) | ✅ scoped | ✅ edit while pending 🔧 | ✅ cancel while pending 🔧 | approve/reject ✅, balance moves ✅, non-report refused ✅ | ✅ |
| Leave policy / holiday / weekend | ✅ | ✅ | ✅ weekend per company 🔧 | holiday ✅ | rebuild balances ✅ | ✅ |
| Attendance | clock in/out ✅ | ✅ | — | — | regularisation ✅ | ✅ |
| Timesheet project / entry | ✅ | ✅ | ✅ | ✅ 🔧 (delete reachable) | submit/approve/reject ✅ 🔧 (scope) | ✅ |
| Payroll run | ✅ UI+API | ✅ | recalculate ✅ | — | submit/approve/lock/reopen ✅, maker-checker ✅ | ✅ |
| Compensation item | ✅ | ✅ | — | ✅ | | ⛔ |
| Expense category / claim | ✅ UI+API | ✅ | ✅ draft | ✅ draft | submit, cancel, 2-step approval ✅ | ✅ |
| Loan / advance | ✅ UI+API | ✅ | — | — (cancel ✅) | 2-step approval ✅, one open loan ✅ | ✅ |
| Job posting | ✅ UI+API | ✅ | ✅ edit, close, reopen 🔧 | — | public careers feed ✅ | ✅ 🔧 |
| Application | ✅ UI+API (Add candidate) 🔧 | ✅ | status ✅ | — | hire (idempotent) ✅ | ✅ |
| Review cycle / goal / review | ✅ UI+API 🔧 | ✅ | ✅ edit cycle, edit goal, progress 🔧 | — | rating bounds ✅ | ✅ |
| 1-on-1 | ✅ UI+API 🔧 (tenant + scope) | ✅ | ✅ | ✅ | | ✅ |
| eNPS survey | ✅ UI+API 🔧 | ✅ | ✅ publish/close/reopen | ✅ | respond once per employee 🔧, employee Surveys page 🔧 | ✅ |
| Peer review | ✅ API 🔧 | ✅ | ✅ | ✅ | | ⛔ no page |
| LMS course | ✅ UI+API 🔧 | ✅ | ✅ edit 🔧 | ✅ archive 🔧 | enrol + progress ✅ | ✅ |
| Onboarding | ✅ template UI+API 🔧; start ✅ UI | ✅ | ✅ edit template (locks once started) 🔧; task complete | switch off | | ✅ |
| Pre-boarding | invite ✅ API | ✅ | — | — | portal by token | ⛔ no invite screen |
| Offboarding | ✅ UI+API | ✅ | decision, cancel ✅ | — | | ✅ |
| Workflow, custom field, formula, report definition | ✅ API | ✅ | ✅ | ✅ | 🔧 custom field key | hidden (no menu entry; address redirects to Settings) |
| API key | ✅ UI | ✅ (secret shown once ✅) | — | ✅ revoke | | ✅ 🔧 admin-only notice |
| Webhook | ✅ UI | ✅ | ✅ | ✅ | test send, SSRF refusal ✅ | ✅ |
| Biometric device | ✅ UI | ✅ | ✅ | ✅ | unregistered device refused ✅ | ✅ |
| Branding / SSO | upsert ✅ | ✅ | ✅ | — | admin only ✅ | ✅ |
| Payment request / receipt | ✅ UI | ✅ | proof upload ✅ | cancel ✅ | quote server-side ✅, one open request ✅ | ✅ 🔧 (plan preselect) |
| Platform: tenant, plan, subscription, override, accounts, packs, settings, grants | ✅ | ✅ | ✅ | override ✅ | approve/reject ✅, idempotent grant ✅, suspend 🔧 | ✅ |
| AI conversation | ✅ UI | ✅ private | — | ✅ | confirm once, tenant/company switches ✅ | ✅ |
| Notifications | — | ✅ own | mark read ✅ own only | — | | bell |

## 4. Bugs found (all fixed; commits on `claude/serene-rubin-xa92dj`, not pushed)
| # | Sev | Bug | Fixed in |
|---|---|---|---|
| B9 | **Blocker (security)** | `POST /enps/surveys/:id/respond` had **no auth guard** and no tenant check: anyone on the internet could post scores into any company's active survey | b8de79b |
| B5 | Major (cross-tenant) | 1-on-1 create accepted another company's employee id (and returned their name); managers could schedule with non-reports | b8de79b |
| B6 | Major (cross-tenant) | Peer review, time-entry `projectId` and offboarding `employeeId` were not verified to belong to the tenant | b8de79b |
| B2 | Major | Any manager could approve/reject any employee's timesheet entry (non-reports, drafts, their own) | a709c2d |
| B7 | Major | Application status took any string (500 from the database) and could mark HIRED without creating an employee | b8de79b |
| B11 | Major (ops) | Operator "Suspend" only switched off plan-gated features; the company kept full access. Now it blocks all sign-ins and API calls, and un-suspending restores them | f31dfeb |
| B12 | Major (regression I introduced earlier) | Reports page was empty for managers (a 403 from payroll-cost rejected the whole page load) | 24e6b8c |
| B13 | Major | Leave, Approvals, Attendance, Onboarding, Employees: a refused action did nothing visible (no error shown) | 24e6b8c |
| B16 | Major | Billing opened with "That plan is not available" and a disabled button for any company on a retired plan (every existing customer) | 8141cc3 |
| B18 | Major | Timesheet "Delete entry" only existed on mouse hover (impossible on phones and by keyboard) | 8141cc3 |
| B1,B3,B4,B8,B10,B14,B15,B17,B19,B20 | Minor | Empty names accepted (9 forms); end-before-start review cycle; unbounded peer rating; custom-field key rules; employees list had no pagination UI; ESS attendance called a manager endpoint; unassociated form labels; HR could open admin-only settings pages; signup owner (no employee profile) got errors on timesheets/1-on-1 | 5466ac8, a709c2d, b8de79b, 319d2b6, 24e6b8c, 8141cc3, 1c9a2ed, fe8a837 |
Screenshots of the verified flows: `docs/qa/screenshots/` (`employees-*`, `leave-*`, `settings-leave-*`, `logins-invited`, `expenses-*`, `loans-*`, `payroll-*`, `timesheet-entry`, `one-on-one-form`, `api-key-created`, `webhook-created`, `device-registered`, `kanban`, `page-<role>-<route>` for every page).

## 5. Still open: what the client must not touch, and the workaround
| Item | Workaround |
|---|---|
| **Pre-boarding**, **Departments/Designations** and **Compensation items** have no create screen (API only) | Create them beforehand or through the API; do not show creating them. (Everything else in the proposal now has a screen.) |
| **Workflows** and **Custom fields** are hidden (no menu entry; their addresses return to Settings) until they can be edited | Not part of the demo; the API still works |
| **Not exercised**: a real AI provider call, real email (SMTP), real MinIO privacy, WhatsApp live webhook, biometric hardware, the mobile app | Covered by mocks or by the production runbook (`docs/matrixhr-prod-runbook.md`) |
| Leave: a request that is already approved cannot be cancelled or edited by the employee (by design); half-day on a weekend still counts 0.5 only if the day is a working day | Ask HR to reject a pending one, or raise a new request |

## 6. Permission and isolation results
- **Role x route matrix (generated from the controllers):** 0 violations. Employee, manager, HR, company admin, operator checked against every role-gated route (`specs/06`).
- **Object level, per role (API):** employee cannot read/edit a colleague's expense, loan, goal, review, timesheet entry, leave request, enrolment, offboarding case or notification; a manager cannot decide leave, expenses or timesheets of a non-report (leave and expenses were already correct, timesheets fixed); HR cannot mint a company admin; maker-checker holds on payroll (preparer cannot approve) and loans/expenses use the configured chains.
- **Tenant isolation:** every list route as tenant B returns none of tenant A's rows; detail/patch/delete of A's ids from B return 403/404 for employees, claims, loans, payroll runs, reviews, surveys, webhooks, API keys, payment requests, conversations; foreign keys from another company are refused on employees, 1-on-1, peer reviews, time entries, offboarding, compensation items. Browser: tenant B opening A's employee page or receipt page shows nothing of A.
- **Public surface:** exactly 24 routes need no login (auth, health, careers feed, SSO discovery, signed file link, signed WhatsApp webhook, device protocol, invite/pre-boarding tokens); the unauthenticated eNPS route was the only one that should not have been public.

## 7. Owner decisions: implemented and tested (spec `08-decisions`, `15-ui-new-screens`)
1. **eNPS one answer per employee** ✅. New table `EnpsParticipation` (who answered, never what) in migration `2_hr_modules`; the participation row is claimed with `ON CONFLICT DO NOTHING` in the same transaction as the answer, so 4 simultaneous submits count once; a second try answers 409 "already answered". Results stay anonymous (no respondent on the answer rows). Employees answer on the new **Surveys** page; HR creates/publishes/closes surveys on the eNPS page.
2. **Owner profile at signup** ✅. Public signup and operator-created companies both create an employee record for the owner (optional first/last name; defaults to "Company Owner") and this year's leave balances. Time Clock, Timesheets, My profile, leave and 1-on-1s work for the owner.
3. **Trial = every module for 30 days** ✅. While a subscription is `trialing` every feature any plan knows is on; when the trial ends the plan's own features apply again (tested both ways).
4. **Suspend = hard stop with a clear message** ✅. Sign-in answers 403 `ACCOUNT_SUSPENDED` "Account suspended. Please contact support." (only after the password is right, so a wrong password reveals nothing); an open session switches to a full-page "Account suspended" screen; un-suspending restores access.
5. **Leave counts working days** ✅. Weekends (per company, default Saturday + Sunday, set in Settings > Leave) and public holidays are not deducted; the apply form shows the working-day count live; weekend-only dates are refused with a reason. Existing approved leave is not recalculated.

## 7b. Also built in round 2
- **Leave cancel and edit while pending** (employee's own request; HR can cancel any pending one). The balance follows every change, double-cancel releases the days once, an approved request is locked.
- **Create/edit screens:** Recruitment (job: new, edit, close/reopen; add candidate), Performance (review cycles: new/edit; goals: new/edit/progress), Onboarding (checklist builder, start for an employee; tasks lock once someone starts), Learning (course new/edit/archive; employee enrol and progress), eNPS (survey new/publish/close/delete; employee Surveys page).
- **Workflows and Custom fields hidden** until they are editable.
- **Single-company mode** (`SINGLE_COMPANY_MODE=true`, for customers who buy the source): every module on with no plan; no Billing/platform screens, trial, lapse gate, payment routes (404) or AI credit limits; sign-up closed once the company exists. Tested against a second API instance. See `docs/DEPLOYMENT.md`.

## 7c. Earlier launch blockers: confirmed with evidence
| Blocker | Status | Evidence |
|---|---|---|
| Staff logins (invite, role, email link, resend/revoke; hire offers it) | ✅ done | `specs/01` invites; `specs/11` UI invite; billing journey F: invite, accept, single-use link, sign in as the manager |
| Leave setup (policies, holidays, balances per policy) | ✅ done | `specs/02` policy/holiday/balance; `specs/11` UI; journey: 25 of 25 people got a balance; plus weekend setting (round 2) |
| Expense/loan tables + `CompensationItem.sourceType/sourceId` in the migration | ✅ done | `1_ai_billing` has `CREATE TABLE IF NOT EXISTS` for all four and `ADD COLUMN IF NOT EXISTS` for both columns; rehearsal ALL PASSED on 5 prod-like databases (94 tables), payroll runs with the tables empty (`launch.integration.spec`) |
| 30-day trial at signup | ✅ done, upgraded | journey A: trial 30 days + 100 AI credits; `specs/08`: now every module during the trial |
| Private files + payroll-cost restricted | ✅ done | journey G (signed links, tamper/cross-company refused); matrix: manager gets 403 on payroll-cost |

## 7d. Round 3: structure, pay components, white-label (specs `16`, `17`, `18`; `common/brand.spec.ts`)
| Item | Result | Evidence |
|---|---|---|
| **Departments and designations**: create, rename, nest (cycle refused), CSV-style import, edit, delete | ✅ | `16` API: duplicate names refused (any case), a department cannot sit under its own child, foreign-company parent refused, other company gets 404 on edit/delete, employee gets 403; import reports created/skipped/errors; every action is in the audit log. `18` UI: the same flow on `/settings/structure` |
| **Delete refused while in use** | ✅ | 409 with the reason ("still in use by 1 sub-department", "employee(s) still hold it") for a department with sub-departments or people, and for a designation someone holds; deletes once emptied. Screenshot `structure-delete-refused.png` |
| **Pay components** (allowance, bonus, arrears, deduction; recurring or one-off; start and end month) | ✅ | New screen `/settings/compensation`. Create, **edit (new PATCH)**, remove. Months validated (`YYYY-MM`, end not before start). Loans and advances stay read-only ("managed by loans"). Payroll reads the same table with the same rules as before (`resolveCompensation` untouched; the payroll integration specs pass). |
| **Audit of every change** | ✅ | CREATE / UPDATE (with before and after values) / DELETE recorded for pay components; CREATE / UPDATE / DELETE / IMPORT for departments and designations |
| **White-label**: product name, logo, favicon, colour, support email, email sender name, website | ✅ | Set by `WL_*` env on the API and web containers (documented in `docs/DEPLOYMENT.md` and `.env.example`). `17`: a second API and web server started with `WL_*`; `/brand` and `/auth/me` carry it; the standard server still says MatrixHR |
| **No vendor text anywhere a client sees it** | ✅ | `17` scans the rendered HTML of every public page (sign-in, forgot/reset password, accept invite, sign-up, kiosk, 404), the page text of 40 signed-in screens as company admin, 6 backoffice screens as operator, page titles, `/robots.txt`, `/sitemap.xml`, the API docs JSON, `/brand`, the password-reset email, the authenticator label and the AI assistant's own system prompt (echoed by the mock model). Jest checks the payslip PDF text (hex-decoded from the deflated stream) and the receipt issuer. Zero matches for MatrixHR or TREEVOXA |
| Vendor marketing page | ✅ | `/` redirects to the sign-in in white-label mode |
| Colour and logo | ✅ | The palette is generated from `WL_PRIMARY_COLOR` (CSS variables, light and dark); checked: `--brand-500` equals the chosen colour and the sign-in button is no longer green. Logo shown on sign-in and the sidebar; favicon and title from config |
| Mobile app config | ✅ (config only) | `apps/mobile/app.config.js` reads the same `WL_*` variables (name, slug, scheme, bundle id, colours); screens read the name from it. Not built into a binary here: that needs an EAS build |
| **Per-client logo in the backoffice** | ✅ | `/platform/:id` has a Branding card. API: `PUT/DELETE /platform/tenants/:id/logo` (operator only; PNG/JPEG/WebP decided from the file bytes, SVG refused, 256 KB limit; audited). The logo shows in that company's header (every user of it) and on its payslips (PNG/JPEG); other companies are unaffected (`16`, `18`) |
| **Multi-client hosting stays on** | ✅ | White-label does not touch tenancy. The operator creates companies, assigns plans, records payments and suspends, as before (the existing `07` and `14` isolation specs pass unchanged) |
| **Receipts** | ✅ | Issued by the reseller (name, support email, optional `WL_LEGAL_TEXT`) with a number prefix taken from the product name; the vendor's NTN and address are not printed |
| **AI assistant: white-label and single-company** | ✅ | The assistant was built in the earlier PR; this round makes its system prompt, app guide and nav label brand-aware (nav label is now "AI assistant"). White-label: replies and prompt carry the reseller's name, never the vendor's (`17`). Single-company: unlimited credits, no purchase screens (`09`) |

Notes
- **Receipt numbers issued before a server turns white-label keep their old `TVX-` prefix.** A new reseller install starts clean, so this only matters if you switch an existing server over.
- The default plan on the Billing screen can be one a company has outgrown; the screen shows the server's message ("Starter allows up to 25"). Not changed.
- **Clean-database run:** the suite was re-run from a freshly created, migrated and seeded empty database: **149 / 149 pass**, jest 160 / 160 (with DB integration specs), API type-check clean. That run found one real white-label leak (the Billing screen's "no bank details yet" message named the vendor's support address; now uses the configured support address) and two test flakes (a strict-mode alert selector, a slow `networkidle`), all fixed.
- A new server shows no payment wizard until the operator adds an active bank account in the backoffice (Billing > Payment accounts); the billing journey also expects its own fixture IBAN.
- No schema change in this round, so the migration rehearsal was not re-run (3 migrations, unchanged).
- Not tested: a real SMTP send, a real AI provider (the mock model is used), a mobile binary.

## 7e. Round 4: two billing currencies (spec `19-currency`; jest `common/currency.spec.ts`, `billing.integration.spec.ts`)
| Requirement | Result | Evidence |
|---|---|---|
| Each plan and credit pack stores a USD **and** a PKR price, set by hand | ✅ | Migration `3_currency` (additive, idempotent; fills the starting prices where empty); backoffice plan and pack editors have the PKR fields; an edit shows on `/pricing` at once and is audited. Seeds: Starter $25 / PKR 6,999, Growth $69 / PKR 18,999, Business $149 / PKR 39,999 (+ $0.50 / PKR 140), yearly 10 x monthly; packs $10 / 2,799, $45 / 12,499, $120 / 32,999 |
| Marketing page: PK sees PKR; US, UK, UAE see USD; switch works | ✅ | `19`: `CF-IPCountry` PK / US / GB / AE; no header: time zone Asia/Karachi = PKR, Europe/London = USD; the switch flips every price both ways. Screenshots `pricing-pkr.png`, `pricing-usd-*.png`. The live geo-IP lookup is built (off with `GEOIP_LOOKUP=off`) but not tested (no internet in the test environment) |
| Company currency fixed at sign-up from the country; only the operator can change it | ✅ | `19`: PK / pk = PKR; US, GB, AE, DE and no country = USD; bad country code 400. A company admin gets 403 on the currency endpoint and 400 when it tries to smuggle `billingCurrency` through branding. Operator change needs a reason, is audited (from, to, reason), and is refused (409) while a payment is open |
| Quote, payment amount and reference, receipt, emails in the company's currency | ✅ | PKR company: quote 18,999 / 189,990, credit pack 12,499 and 2,799, request, proof, approval, receipt `PKR 18,999`, approval email "Amount received: PKR 18,999". USD company: $69, credit pack $10, receipt and email in dollars. Jest: Business overage in PKR = 39,999 + 2 x 140 = 40,279 (yearly 403,350) |
| Payment accounts have a currency; a company sees and can use only its own | ✅ | PKR company sees only the PKR account and gets 404 paying into a USD one, and the reverse; the Billing screen shows no other-currency text |
| One formatter: "PKR 18,999", "$69", "$0.50" | ✅ | `formatMoney` in `@matrixhr/shared`, used by the landing page, Billing, receipts, backoffice and emails; jest covers the cases |
| White-label `WL_CURRENCIES`; single-company shows no prices | ✅ | A second API with `WL_CURRENCIES=USD` bills a Pakistani client in USD, offers one currency on `/pricing` and refuses a PKR change; single-company `/pricing` is 404 (spec `09`) |
Notes: amounts stay exact two-decimal numbers per currency (not integer minor units); companies that were already on a PKR plan become PKR; the billing journey now creates its own bank account.

## 8. Demo-safe path (fully verified, in this order)
1. **Owner/HR:** sign up a fresh company (trial, every module) → Employees (add, search) → Recruitment (new job, add candidate, Applicant board) → Onboarding (new checklist, start for an employee) → Performance (new cycle) → Learning (new course) → eNPS (new survey, publish).
2. **Employee:** Leave (apply: the form shows working days; edit; cancel) → Timesheets → Expenses → Loans → Performance (new goal, progress) → Learning (enrol) → Surveys (answer once) → the AI assistant.
3. **Manager:** Approvals → Expenses → 1-on-1s → Reports.
4. **HR/Admin:** Settings > Leave (weekend, holidays, leave types) → Staff logins → Payroll (run, submit; admin approves, locks).
5. **Operator:** Billing (approve, receipt), AI assistant settings, Suspend a test company and show the suspended screen (then un-suspend).
Skip: Pre-boarding invite (not promised).
6. **Set-up of a new client company (new in round 3):** Settings > Departments & designations (import a list, edit, try to delete one in use) → Settings > Pay components (add an allowance and a one-off bonus for an employee; edit; remove) → Payroll run shows them.

## How to re-run
```
/var/tmp/up.sh            # (sandbox helper) or: pnpm dev stack with web built (next build + next start); API with AUTH_THROTTLE_LIMIT and THROTTLE_LIMIT raised
pnpm test:qa              # tests/qa-crud, 158 specs, ~7 min (web as a production build)
node scripts/billing-ui-test.mjs && node scripts/ai-ui-test.mjs   # journeys (mock LLM: node scripts/mock-llm.mjs 9100)
python3 tests/qa-crud/gen-routes.py   # refresh the route table after adding endpoints
```
The suite refuses to run unless the database host is local (set `QA_ALLOW_REMOTE_DB` only for staging).
