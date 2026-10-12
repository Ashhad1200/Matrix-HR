# Release notes: rounds 2 and 3 (everything after the merged QA-fixes PR)

**Base:** `master` already contains the QA fixes (PR #4 as merged on 2026-10-12, 20 bug fixes plus `tests/qa-crud`). This release adds everything below on top of it. It was developed on `claude/serene-rubin-xa92dj`.

## What changed
**Owner decisions (round 2)**
- eNPS: one answer per employee per survey (anonymous; only participation is stored).
- The company owner gets an employee profile at sign-up.
- A trialing company gets every module for the trial; suspending a company shows a clear full-page message.
- Leave counts working days (weekends and public holidays are not deducted); weekend days are set per company in Settings > Leave.
- Employees can edit or cancel their own pending leave; HR can cancel any pending request.
- Workflows and Custom fields are hidden until they are editable.
- `SINGLE_COMPANY_MODE=true` for customers who buy the source: every module on, no billing/trial/credits screens, no lapse gate, sign-up closed once the company exists.

**New screens (round 2)**: Recruitment (jobs, candidates), Performance (cycles, goals, eNPS surveys), Onboarding (checklists), Learning (courses), Surveys (employee answer page).

**Round 3**
- **Departments and designations**: Settings > Departments & designations. Create, rename, nest, import a list, edit, delete. Delete is refused while people, sub-departments or job holders still use it. Every action is audited.
- **Pay components**: Settings > Pay components. Per employee: allowance, bonus, arrears, deduction; recurring or one-off; start and end month. New edit endpoint and audit trail. Payroll reads them exactly as before; loans and advances stay read-only.
- **White-label** (for resellers, many client companies on one server): product name, logo, favicon, colour, support email, email sender name and website come from env. No vendor name appears in the web app, sign-in, titles, emails, payslip PDFs, receipts, WhatsApp replies, authenticator label, API docs or the AI assistant. Backoffice has a per-client logo upload (Branding card on each company). Mobile app config reads the same variables (no binary built).
- **AI assistant**: prompts, app guide and nav label follow the brand ("AI assistant"). No credit limits in single-company mode.

## Migrations
One new migration: **`2_hr_modules`**. It is additive and idempotent (`ADD COLUMN IF NOT EXISTS "Tenant"."weekendDays"` defaulting to Saturday + Sunday, and `CREATE TABLE IF NOT EXISTS "EnpsParticipation"`). No drops, renames or type changes, so existing rows are untouched and it is safe to apply twice. `scripts/migration-rehearsal.sh` passed on 5 production-like databases (applied twice each, row fingerprints unchanged). Round 3 added **no** schema change.

## New environment variables (all optional; leave unset on the main TREEVOXA production)
| Variable | Where | Meaning |
|---|---|---|
| `SINGLE_COMPANY_MODE` | API | `true` for a one-company source install. Never on a multi-tenant server. |
| `WL_PRODUCT_NAME` | API + web | Turns white-label on. |
| `WL_LOGO_URL`, `WL_FAVICON_URL`, `WL_PRIMARY_COLOR` (`#RRGGBB`), `WL_SUPPORT_EMAIL`, `WL_EMAIL_FROM_NAME`, `WL_WEBSITE_URL`, `WL_LEGAL_TEXT` | API + web | Brand details (see `docs/DEPLOYMENT.md`). |
| `WL_APP_ID` | mobile build | Bundle id for a white-label app build. |

Both are listed in `.env.example` and passed through `docker-compose.yml`.

## API changes
- **New public route `GET /api/v1/brand`**: name, logo, colour, support email, website. Contains nothing secret; the sign-in page needs it before login.
- New: `PATCH/DELETE /employees/departments/:id`, `POST /employees/departments/import`, the same for `designations`, `PATCH /payroll/compensation-items/:id`, `PUT/DELETE /platform/tenants/:id/logo` (operator only).
- `GET /auth/me` now also returns `deployment` and `brand`.
- Dependency: `expo-constants` added to the mobile app (lockfile updated).

## After deploying: what an operator must do
1. Deploy; the API entrypoint runs `prisma migrate deploy` (applies `2_hr_modules`). Confirm `/health` is OK.
2. Nothing to set in production for this release: **do not** set `SINGLE_COMPANY_MODE` or `WL_*` on the TREEVOXA production.
3. Tell customers: leave now counts working days. Each company should check its weekend in Settings > Leave (default Saturday + Sunday) and add public holidays.
4. Existing companies keep their current period end; nothing lapses until the operator sets a renewal date.
5. For a reseller install (separate server): set the `WL_*` variables on the API and web containers, then in the backoffice upload each client's logo.

## Verification
- Full QA suite (`pnpm test:qa`) from an empty database: see the result at the end of the PR conversation.
- API jest including DB integration specs, API type-check; web production build. The web app has no ESLint config (CI lints the API only).
- Not tested: real SMTP, a real AI provider (a mock model is used), a mobile binary.
