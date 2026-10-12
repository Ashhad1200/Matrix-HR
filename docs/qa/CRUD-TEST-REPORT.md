# CRUD test report (client handover)

Run: 2026-10-12, local stack only (Postgres 127.0.0.1:5433 `matrixhr`, API :3001, web :3000 as a **production build**; two fresh tenants `ZZ-TEST-A` / `ZZ-TEST-B`, one user per role).
Suite: `tests/qa-crud/` (run with `pnpm test:qa`). Inventory: `docs/qa/crud-matrix.md`. Accounts: `docs/qa/test-accounts.md`. Screenshots: `docs/qa/screenshots/` (121).

## 1. Verdict
✅ **Ready for the client demo, with the caveats in section 5.** Everything the proposal promises has a working screen, and every create/read/update/delete, approval chain, permission and isolation check passes. Round 2 (this update) added the owner's five decisions and the missing screens; round 1's 20 bugs are all fixed.

## 2. Totals
| | Round 1 | Round 2 (after the owner's decisions) |
|---|---|---|
| Automated specs (`pnpm test:qa`) | 103 / 103 | **130 / 130 pass** (API 93 incl. the 6 matrix specs; browser 37) |
| Route matrix | 292 routes | 298 routes: 401 without a token everywhere; 403 for every non-listed role on every role-gated route; tenant B sees no tenant A row; the 24 public routes are exactly the intended ones |
| Browser journeys | billing, AI | billing (staff logins, leave setup, private files, payments) passes; AI assistant passes (22 checks) |
| API unit + DB integration | 153 | 153 pass |
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

## 8. Demo-safe path (fully verified, in this order)
1. **Owner/HR:** sign up a fresh company (trial, every module) → Employees (add, search) → Recruitment (new job, add candidate, Applicant board) → Onboarding (new checklist, start for an employee) → Performance (new cycle) → Learning (new course) → eNPS (new survey, publish).
2. **Employee:** Leave (apply: the form shows working days; edit; cancel) → Timesheets → Expenses → Loans → Performance (new goal, progress) → Learning (enrol) → Surveys (answer once) → Ask MatrixHR.
3. **Manager:** Approvals → Expenses → 1-on-1s → Reports.
4. **HR/Admin:** Settings > Leave (weekend, holidays, leave types) → Staff logins → Payroll (run, submit; admin approves, locks).
5. **Operator:** Billing (approve, receipt), AI assistant settings, Suspend a test company and show the suspended screen (then un-suspend).
Skip: Pre-boarding invite, Departments/Designations, Compensation items (no create screen).

## How to re-run
```
/var/tmp/up.sh            # (sandbox helper) or: pnpm dev stack with web built (next build + next start); API with AUTH_THROTTLE_LIMIT and THROTTLE_LIMIT raised
pnpm test:qa              # tests/qa-crud, 130 specs, ~6 min (web as a production build)
node scripts/billing-ui-test.mjs && node scripts/ai-ui-test.mjs   # journeys (mock LLM: node scripts/mock-llm.mjs 9100)
python3 tests/qa-crud/gen-routes.py   # refresh the route table after adding endpoints
```
The suite refuses to run unless the database host is local (set `QA_ALLOW_REMOTE_DB` only for staging).
