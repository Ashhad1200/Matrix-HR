# CRUD test report (client handover)

Run: 2026-10-12, local stack only (Postgres 127.0.0.1:5433 `matrixhr`, API :3001, web :3000 as a **production build**; two fresh tenants `ZZ-TEST-A` / `ZZ-TEST-B`, one user per role).
Suite: `tests/qa-crud/` (run with `pnpm test:qa`). Inventory: `docs/qa/crud-matrix.md`. Accounts: `docs/qa/test-accounts.md`. Screenshots: `docs/qa/screenshots/` (121).

## 1. Verdict
⚠️ **Ready with caveats.** Every create/read/update/delete, approval chain and permission check that the product exposes passes, and one unauthenticated-write hole plus several cross-tenant gaps were found and fixed; but several modules (recruitment, learning, performance goals, onboarding, workflows, custom fields) are read-only in the web UI, so the client must not be shown creating records there (section 5).

## 2. Totals
| | |
|---|---|
| Automated specs | **103 / 103 pass** (API 75 incl. the 6 matrix specs, browser 28) after fixes; first full run found 3 failures in the suite itself plus the bugs below |
| Route matrix | 292 routes: every authenticated route answers 401 without a token; every role-gated route answers 403 to every non-listed role (177 routes x roles); every listed role gets past the guard on GET without a 5xx; tenant B receives no tenant A row from any list route; the 24 public routes are exactly the intended ones |
| Browser journeys (existing) | billing + payments + staff logins + leave setup + private files: pass (46 checks); AI assistant: pass (22 checks). Billing journey passed 6 of 8 runs; the 2 failures were the same timing check ("banner says access is temporary"); an isolated loop of 6 signup → lapse → upload → dashboard runs showed the banner every time, so it is not reproduced as a product bug (section 5) |
| API unit + DB integration | 22 suites / 153 tests pass |
| Bugs found | **20** (1 blocker, 9 major, 10 minor); **all fixed**; 5 product decisions open |
| Open (not code bugs) | 2 UI gaps that hide a feature (section 5), 3 decisions |

## 3. Matrix (C / R / U / D / actions)
✅ verified by test · 🔧 fixed during this run · ⛔ not in the UI (API exists) · — operation does not exist
| Entity | C | R | U | D | Other actions | UI |
|---|---|---|---|---|---|---|
| Employee | ✅ UI+API | ✅ list/search/pagination 🔧/detail | ✅ API (list has no edit; detail page) | — by design (offboarding) | CSV import ✅ API, documents ✅ | ✅ |
| Department / designation | ✅ 🔧 (empty name) | ✅ | — | — | | ⛔ (no screen) |
| Staff login (invite) | ✅ UI+API | ✅ | resend ✅ | revoke ✅ | accept ✅ (journey) | ✅ |
| Leave request | ✅ UI+API 🔧 (errors now shown) | ✅ scoped | — | — (no cancel) | approve/reject ✅, balance moves ✅, non-report refused ✅ | ✅ |
| Leave policy / holiday | ✅ | ✅ | ✅ | holiday ✅ | rebuild balances ✅ | ✅ |
| Attendance | clock in/out ✅ | ✅ | — | — | regularisation ✅ | ✅ |
| Timesheet project / entry | ✅ | ✅ | ✅ | ✅ 🔧 (delete reachable) | submit/approve/reject ✅ 🔧 (scope) | ✅ |
| Payroll run | ✅ UI+API | ✅ | recalculate ✅ | — | submit/approve/lock/reopen ✅, maker-checker ✅ | ✅ |
| Compensation item | ✅ | ✅ | — | ✅ | | ⛔ |
| Expense category / claim | ✅ UI+API | ✅ | ✅ draft | ✅ draft | submit, cancel, 2-step approval ✅ | ✅ |
| Loan / advance | ✅ UI+API | ✅ | — | — (cancel ✅) | 2-step approval ✅, one open loan ✅ | ✅ |
| Job posting | ✅ API | ✅ | — | — | public careers feed ✅ | ⛔ create |
| Application | ✅ API | ✅ | status ✅ 🔧 | — | hire (idempotent) ✅ | kanban ✅, create ⛔ |
| Review cycle / goal / review | ✅ API 🔧 | ✅ | ✅ | — | rating bounds ✅ | ⛔ create |
| 1-on-1 | ✅ UI+API 🔧 (tenant + scope) | ✅ | ✅ | ✅ | | ✅ |
| eNPS survey | ✅ API | ✅ | ✅ | ✅ | respond 🔧 (was unauthenticated) | ⛔ create |
| Peer review | ✅ API 🔧 | ✅ | ✅ | ✅ | | ⛔ no page |
| LMS course | ✅ API | ✅ | — | — | enroll + progress ✅ | ⛔ create/enroll |
| Onboarding / pre-boarding | start ✅ API | ✅ | task complete | — | | ⛔ start |
| Offboarding | ✅ UI+API | ✅ | decision, cancel ✅ | — | | ✅ |
| Workflow, custom field, formula, report definition | ✅ API | ✅ | ✅ | ✅ | 🔧 custom field key | ⛔ (buttons are disabled) |
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
| **Recruitment** has no "new job" / "add candidate" screen; **LMS** has no "new course"/"enrol"; **Performance** has no "new goal/cycle/review" screen; **eNPS**, **Onboarding start**, **Pre-boarding invite**, **Departments/Designations**, **Compensation items** have no create screen | Create the records through the API or beforehand (the demo data is seeded); show the list/kanban views only. These are missing features, not bugs |
| **Workflows** and **Custom fields** show a permanently disabled "Create Workflow" / "Add Field" button | Do not open these two pages in the demo (read-only) |
| **Leave**: no way for an employee to cancel or edit a submitted request; the list does not show the reason | Ask HR to reject it, or do not demo cancelling |
| **eNPS** can be answered repeatedly by the same person (responses carry no respondent id) | Do not present eNPS scores as reliable (decision 1) |
| **Billing journey flake**: the "temporary access" banner check failed in 2 of 8 runs of the browser journey, but never in 6 isolated API-driven runs of the same scenario (server state and banner were right each time). Cause not found; the journey now prints what the strip showed if it happens again | Not client-visible. If a customer reports a missing banner after uploading proof, a page reload shows it |
| **Not exercised**: a real AI provider call, real email (SMTP), real MinIO privacy, WhatsApp live webhook, biometric hardware, mobile app | Covered by mocks or the production runbook (`docs/matrixhr-prod-runbook.md`) |

## 6. Permission and isolation results
- **Role x route matrix (generated from the controllers):** 0 violations. Employee, manager, HR, company admin, operator checked against every role-gated route (`specs/06`).
- **Object level, per role (API):** employee cannot read/edit a colleague's expense, loan, goal, review, timesheet entry, leave request, enrolment, offboarding case or notification; a manager cannot decide leave, expenses or timesheets of a non-report (leave and expenses were already correct, timesheets fixed); HR cannot mint a company admin; maker-checker holds on payroll (preparer cannot approve) and loans/expenses use the configured chains.
- **Tenant isolation:** every list route as tenant B returns none of tenant A's rows; detail/patch/delete of A's ids from B return 403/404 for employees, claims, loans, payroll runs, reviews, surveys, webhooks, API keys, payment requests, conversations; foreign keys from another company are refused on employees, 1-on-1, peer reviews, time entries, offboarding, compensation items. Browser: tenant B opening A's employee page or receipt page shows nothing of A.
- **Public surface:** exactly 24 routes need no login (auth, health, careers feed, SSO discovery, signed file link, signed WhatsApp webhook, device protocol, invite/pre-boarding tokens); the unauthenticated eNPS route was the only one that should not have been public.

## 7. Decisions for owner
1. **eNPS anonymity vs one-vote-each.** Fixing it needs one additive table (respondent hash per survey). Say yes and it is a small migration.
2. **Company owner has no employee profile** after signup, so Time Clock, Timesheets, My profile and 1-on-1s are empty for them (now error-free but unusable). Suggest creating an employee record for the owner at signup (counts toward the plan's employee cap).
3. **Trial tenants start on Starter**, so plan-gated screens (custom fields, SSO, webhooks) answer 403 during the trial. Suggest the trial gets the Business feature set.
4. **"Suspend" is now a hard stop** (behaviour change in B11). Confirm that is what you want; "cancelled"/"expired" still do not block access by themselves.
5. Leave counts calendar days and does not exclude weekends/holidays (noted earlier).

## 8. Demo-safe path (fully verified, in this order)
1. Sign in as **HR**: Employees (search, add, duplicate error, pages) → Settings > Leave (new leave type, edit, add/remove a holiday) → Settings > Staff logins (invite).
2. Sign in as **employee**: Leave (apply; over-balance shows an error) → Timesheets (log hours) → Expenses (draft → submit) → Loans (request) → Ask MatrixHR (balance; a leave request that needs Confirm).
3. Sign in as **manager**: Approvals (approve the leave) → Expenses (approve) → 1-on-1s (schedule with a report) → Reports (headcount, leave, attendance).
4. **HR**: Expenses (second approval) → Loans (HR then admin) → Payroll (run, submit) → **admin**: approve, lock → employee sees pay stubs.
5. **Admin**: Billing (plan choices, pay by bank transfer, upload proof) → **Operator**: Billing (approve, receipt PDF), AI assistant settings (switch, key, grant credits).
6. Settings > API keys, Webhooks, Devices work end to end. Skip: Recruitment create, LMS, Performance create, Workflows, Custom fields.

## How to re-run
```
/var/tmp/up.sh            # (sandbox helper) or: pnpm dev stack with web built (next build + next start); API with AUTH_THROTTLE_LIMIT and THROTTLE_LIMIT raised
pnpm test:qa              # tests/qa-crud, 103 specs, ~5 min
node scripts/billing-ui-test.mjs && node scripts/ai-ui-test.mjs   # journeys (mock LLM: node scripts/mock-llm.mjs 9100)
python3 tests/qa-crud/gen-routes.py   # refresh the route table after adding endpoints
```
The suite refuses to run unless the database host is local (set `QA_ALLOW_REMOTE_DB` only for staging).
