# Release notes: rounds 2 to 4 (everything after the merged QA-fixes PR)

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
Two new migrations, both additive and idempotent. **`2_hr_modules`** (`ADD COLUMN IF NOT EXISTS "Tenant"."weekendDays"` defaulting to Saturday + Sunday, and `CREATE TABLE IF NOT EXISTS "EnpsParticipation"`): no drops, renames or type changes, existing rows untouched, safe to apply twice.
**`3_currency`** (also additive and idempotent): `ADD COLUMN IF NOT EXISTS` for `PlanVersion.priceMonthlyPkr / priceYearlyPkr / overagePerEmployeePkr`, `CreditPack.pricePkr`, `Tenant.billingCurrency` (default `USD`) and `Tenant.country`. It also fills the starting PKR prices on the current plan versions and credit packs where they are still empty (never overwriting a price an operator set), and marks companies already on a PKR plan as PKR. No drops, renames or type changes. The rehearsal (`scripts/migration-rehearsal.sh`, 4 migrations) passes on all five production-like databases.

## Two billing currencies (PKR and USD)
- Each plan and AI credit pack has a **USD price and a PKR price**, set by hand in the backoffice (no FX). Starter $25 / PKR 6,999, Growth $69 / PKR 18,999, Business $149 / PKR 39,999 (+ $0.50 / PKR 140 per extra employee), yearly = 10 x monthly; credit packs 1k $10 / PKR 2,799, 5k $45 / PKR 12,499, 15k $120 / PKR 32,999.
- **Marketing page:** Pakistan sees PKR, everyone else USD, from the `CF-IPCountry` header, then a geo-IP lookup (the visitor's address is sent to ipapi.co unless `GEOIP_LOOKUP=off`), then the browser time zone; a PKR/USD switch is always visible.
- **Sign-up** asks for a country (pre-selected from the visitor); Pakistan bills in PKR, everywhere else in USD, stored on the company. A company cannot change it; only the operator can (audited, refused while a payment is open).
- **Quotes, payment amounts and references, receipts, reminder and approval emails** use the company's currency. **Payment accounts have a currency**; a company only sees accounts in its own.
- One shared formatter everywhere: `PKR 18,999`, `$69`, `$0.50`. Amounts stay exact two-decimal numbers (not integer minor units).
- `WL_CURRENCIES` lets a reseller offer both or just one. Single-company installs show no prices.
- Existing companies keep their plan and period; ones that were already on a PKR plan become PKR.

## New environment variables (all optional; leave unset on the main TREEVOXA production)
| Variable | Where | Meaning |
|---|---|---|
| `SINGLE_COMPANY_MODE` | API (and web) | `true` for a one-company source install. Never on a multi-tenant server. |
| `WL_PRODUCT_NAME` | API + web | Turns white-label on. |
| `WL_LOGO_URL`, `WL_FAVICON_URL`, `WL_PRIMARY_COLOR` (`#RRGGBB`), `WL_SUPPORT_EMAIL`, `WL_EMAIL_FROM_NAME`, `WL_WEBSITE_URL`, `WL_LEGAL_TEXT` | API + web | Brand details (see `docs/DEPLOYMENT.md`). |
| `WL_APP_ID` | mobile build | Bundle id for a white-label app build. |
| `WL_CURRENCIES` | API + web | `PKR,USD` (default) or one currency. |
| `GEOIP_LOOKUP` / `GEOIP_URL` | web | `off` disables the visitor geo-IP lookup; `GEOIP_URL` uses your own service (`{ip}` placeholder). |
| `API_INTERNAL_URL` | web | How the web container reaches the API for the public price list (falls back to `NEXT_PUBLIC_API_URL`). |

All are listed in `.env.example` and passed through `docker-compose.yml`.

## API changes
- **New public routes `GET /api/v1/brand` and `GET /api/v1/pricing`** (`/brand`: name, logo, colour, support email, website, currencies; `/pricing`: the price list in both currencies, 404 on single-company installs). Neither contains anything secret; the sign-in and marketing pages need them before login.
- New: `PATCH /platform/tenants/:id/currency` (operator only, audited), `country` on sign-up, `PATCH/DELETE /employees/departments/:id`, `POST /employees/departments/import`, the same for `designations`, `PATCH /payroll/compensation-items/:id`, `PUT/DELETE /platform/tenants/:id/logo` (operator only).
- `GET /auth/me` now also returns `deployment` and `brand`.
- Dependency: `expo-constants` added to the mobile app (lockfile updated).

## After deploying: what an operator must do
1. Deploy; the API entrypoint runs `prisma migrate deploy` (applies `2_hr_modules` and `3_currency`). Confirm `/health` is OK.
2. **Set the prices and accounts (backoffice):** open Billing > Plans and check every plan shows both a USD and a PKR price (the migration filled the starting values; edit them to yours). Check the AI credit packs show both prices. Then **give every payment account a currency**: PKR for the local bank / Raast account, USD for Payoneer, Wise or an international bank. Until a PKR company has a PKR account it cannot pay; until a USD company has a USD account it cannot either.
3. Nothing else to set in production for this release: **do not** set `SINGLE_COMPANY_MODE` or `WL_*` on the TREEVOXA production.
4. Tell customers: leave now counts working days. Each company should check its weekend in Settings > Leave (default Saturday + Sunday) and add public holidays.
5. Existing companies keep their current period end; nothing lapses until the operator sets a renewal date.
6. For a reseller install (separate server): set the `WL_*` variables on the API and web containers, then in the backoffice upload each client's logo.

## Verification
- **Full QA suite from an empty database** (created, migrated with all 4 migrations, seeded): **158 / 158 pass** (`pnpm test:qa`, web as a production build).
- API jest including the database integration specs: **165 / 165**. API type-check clean. Web production build passes. Migration rehearsal (4 migrations, 5 production-like databases, applied twice): all passed.
- Browser journeys (billing, AI assistant): pass. The billing journey now creates its own bank account.
- The web app has no ESLint config (CI lints the API only).
- Not tested: real SMTP, a real AI provider (a mock model is used), a mobile binary, the live geo-IP service (the country header and the time-zone fallback are tested).
