# AI assistant + manual payments: status

Branch `claude/serene-rubin-xa92dj`. No PR yet. Plan: `docs/ai-manual-payments-plan.md`.
Owner decisions applied: trial for NEW signups only, existing tenants have no period end and never lapse; USD v2 plans + Business,
old PKR plans hidden from new signups; Gemini kept as a third provider if used; CI runs on master; migration safety first.

## A. Launch blockers (reported separately, built before AI)

| # | Item | State | Evidence |
|---|---|---|---|
| 1 | **Staff logins**: HR/admin invite an employee (role picked), emailed set-password link, resend/revoke; hiring a candidate offers the same invite | Done: API + web (Settings > Staff logins, accept-invite page, Hire modal invite) | `invites/` module, `UserInvite` table, `launch.integration.spec.ts` (single-use, simultaneous accepts, resend/revoke/expiry, escalation, cross-tenant, admin-seat cap, hire + invite) |
| 2 | **Expense/loan tables + `CompensationItem.sourceType/sourceId`** in the migration (IF NOT EXISTS); payroll must not fail if they are empty | Done | `1_ai_billing` adds all 4 tables and both columns; rehearsal runs 5 prod-like DB states twice; test runs a payroll run with empty expense/loan tables |
| 3 | **Leave setup**: policies + holidays CRUD, balances auto-created per employee per policy, yearly accrual, carry-forward | Done: API + web (Settings > Leave) | `leave/` endpoints (HR/admin only), `common/leave-balances.ts`; tests: backfill on policy create, lazy create so limits really apply, carry-forward cap, gender-restricted types, entitlement edits, holiday isolation |
| 4 | **30-day trial** for new signups, 100 AI credits | Done (agreed) | `BillingService.startTrial`, called only from public `signUp`; tests: new signup gets trial, existing tenant untouched, no free plan credits after trial |
| 5 | **Private payslip/document storage with signed URLs; `/reports/payroll-cost` HR/admin only** | Done (API) | public-read bucket policy removed on boot; `FilesService` HMAC links (5 min, tenant-bound), `GET /files/:token`; employee documents only accept this tenant's own files; payslip lists no longer expose the stored reference; role metadata tested; web uses signed links for payslips, documents, expense receipts |

Known limits of item 3: "monthly" accrual is stored but not pro-rated (full yearly entitlement is granted); joiners mid-year get the full year; leave
days are counted as calendar days (holidays/weekends are not excluded yet); `eligibilityMonths` is stored, not enforced.

## B. Manual payments (Phase 2)
API done and tested (25 DB integration tests): server-computed quotes, one open request per purpose, byte-sniffed proofs in the DB, row-locked
idempotent approve/reject, TVX-R receipts, provisional access, lapse gate in `JwtStrategy`, reminders once each, retrying outbox, USD seed,
employee cap, admin-seat cap. Web done: pay wizard, banner, lapsed screen, backoffice Billing (4 tabs + plans/packs), receipt page, USD rate card and trial text on the landing page.
Browser journey `scripts/billing-ui-test.mjs` passes (screenshots 01-15 in `docs/screenshots/`).

## C. AI assistant (Phase 1): done
OpenAI / Anthropic / Gemini behind one interface (`ai/providers.ts`); Gemini kept because `/ai/ask` and `rank-candidate` already used it (they now go through the same provider settings, billing and keyword fallback).
Operator page `/platform/ai`: master switch (read fresh per request), provider, model (must be in the price table), write-only encrypted keys, credit grants (audited), usage.
Tenant admins/HR toggle it per company. Chat with history (private per user), attachments (pdf/docx/xlsx/csv/images, type by bytes), tools (leave balances/policies/holidays/requests, directory search, headcount, request/decide leave),
writes only through single-use, user-bound, hash-checked confirmation tokens; no tool deletes or touches payroll, salary or bank data; tool loop capped at 6; per-user rate limit (20/min).
Credits: provider cost x 4, 1 credit = $0.01, images 2000 tokens, reserve then settle on real usage, full refund on provider failure. Tests: `ai.integration.spec.ts` (21), browser journey `scripts/ai-ui-test.mjs` with `scripts/mock-llm.mjs` (screenshots 16-20).
Full API suite: 22 suites / 153 tests pass. NOT tested against a live provider (no keys in the sandbox): the owner should send one real message after adding the key.

## D. Runbook: `docs/matrixhr-prod-runbook.md` (10 steps, first step is the read-only migration-state dump).

## Migration safety (owner's critical item)
- `scripts/migration-rehearsal.sh`: fresh, 0_init-only, db-push+baselined, db-push UNbaselined (fails P3005 as predicted, then recovers), hand-built; each with
  data, deploy twice, SQL re-applied by hand, rows fingerprinted before/after. All pass (93 tables).
- `docker/entrypoint-api.prod.sh`: P3005 is baselined (`migrate resolve --applied 0_init`, never a reset) then retried; opt out with `MIGRATE_BASELINE_ON_P3005=false`.
- `packages/database/prisma/preflight.ts`: READ-ONLY classifier of a live DB (history, failed migrations, mismatches, tenant clocks).

## Open items / decisions to confirm
1. Business overage on yearly billing is charged x12 (usage, no discount); monthly plans x1.
2. Business plan = Growth + the Pro feature set + AI; SSO/EOR/marketplace stay Enterprise-only.
3. `maxAdminUsers` now enforced at invite time (company admin + HR manager roles). No other path creates admin users.
