# Deployment & rollback

This is the procedure and the pre-flight for shipping MatrixHR to production. It maps to
`checklist.md` (items 4, 5, 8 and 9) and to Phase 5 of `ENGINEERING_ROADMAP.md`.

> Status honesty: everything below that is **code** exists and is tested in this repo. The blue-green
> *infrastructure* (two environments + a load balancer) is **not** provisioned by this repo — this document
> is the runbook you follow once it is. Nothing here has been rehearsed against a real production cluster.

## 1. Required configuration

The API **refuses to start** in production (`NODE_ENV=production`) if any of these are unsafe
(`apps/api/src/common/production-config.ts`, unit-tested):

| Variable | Requirement |
|---|---|
| `DATABASE_URL` | set |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | random, ≥ 32 chars, different from each other, not a `dev…` default |
| `CREDENTIAL_KEY` | random, ≥ 32 chars. Encrypts integration tokens and webhook secrets (AES-256-GCM). **Losing it makes stored integration credentials unrecoverable; changing it invalidates them.** Back it up separately from the database. |
| `WEB_URL` | your public web origin(s), comma-separated. It is the CORS allow-list and the base of emailed links. Not `localhost`. |
| `WEBHOOK_ALLOW_PRIVATE_TARGETS` | must **not** be `true` (it disables the SSRF guard) |
| `THROTTLE_LIMIT`, `AUTH_THROTTLE_LIMIT` | must **not** be set (test-only overrides of the rate limits) |

Also set for the features you use: `SMTP_URL` + `MAIL_FROM` (password-reset email — without SMTP the API
logs that mail was *not* delivered), `WHATSAPP_APP_SECRET` + `WHATSAPP_VERIFY_TOKEN` (+ `WHATSAPP_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`), `S3_*`, `TRUST_PROXY` (see below), `APP_VERSION` (shown by the health probes).
`ENABLE_API_DOCS=true` re-enables Swagger, which is off in production by default.

**`TRUST_PROXY`**: behind a load balancer set it to the hop count (`1`) or the proxy subnet. Without it the
API sees every request as coming from the proxy's IP, so the per-IP rate limits act on *everyone at once*.

## 2. Database migrations (read this before the first deploy)

Development uses `prisma db push`. **Production must not** — it can drop columns silently. A verified baseline
migration is in `packages/database/prisma/migrations/0_init` (applied to a scratch database and diffed against
the schema: zero drift).

- **Fresh production database:** `pnpm --filter @matrixhr/database exec prisma migrate deploy`
- **An existing database that was created with `db push`:** mark the baseline as already applied, once:
  `prisma migrate resolve --applied 0_init`, then use `migrate deploy` from then on.
- **Every later schema change:** `prisma migrate dev --name <change>` locally, commit the generated SQL,
  `migrate deploy` in the pipeline.
- ⚠️ `pnpm db:migrate` (`migrate dev`) against a dev database built with `db push` will report drift and offer
  a reset. Answer no, or `pnpm docker:reset` to rebuild the dev DB from migrations.

**Expand / contract.** Blue and green run against the *same* database during a cutover, so every migration
must be compatible with the previous release: add columns as nullable/defaulted first (expand), ship code that
uses them, and only drop/rename in a *later* release (contract). Never ship a migration that the currently
live version cannot run against — that is what makes rollback a load-balancer flip instead of an incident.

## 3. Blue-green procedure

Two identical stacks, **blue** (live) and **green** (idle), one shared database, one load balancer.

1. **Build once, promote the same artifact.** Build the image for the release commit; tag it with the git SHA.
   Set `APP_VERSION` to that SHA on the new stack.
2. **Back up** the database (a fresh snapshot; note its id in the release ticket).
3. **Migrate (expand only):** run `prisma migrate deploy` from the new build. It is safe for blue because of §2.
4. **Deploy to green** (the idle stack). Do not send it traffic yet.
5. **Gate on readiness:** `GET https://green/api/v1/health/ready` must return `200 {"status":"ready"}`
   (it checks the database). Then run the smoke suite against green:
   `API_URL=https://green pnpm test:api && pnpm test:rbac && pnpm test:isolation` (and `test:e2e` against the
   green web origin). Do this against a staging tenant, not customers' data.
6. **Flip the load balancer to green** — ideally weighted 5 % → 25 % → 100 % over a few minutes while watching
   the alerts in `docs/OPERATIONS.md`. Blue stays running and untouched.
7. **Watch for 15–30 minutes:** 5xx rate, p95 latency, login failure rate, webhook failure queue, `/health/ready`.
8. **Rollback = flip the load balancer back to blue.** No rebuild, no redeploy. Because migrations are
   expand-only, blue still works against the migrated database. Investigate green offline.
9. **Only after** green has been stable for a full release cycle: retire blue, then ship the *contract*
   migration (drops/renames) in the next release.

What breaks this: a migration that isn't backward compatible; a config difference between blue and green
(keep them from the same variable set); changing `CREDENTIAL_KEY`/`JWT_SECRET` during a cutover (it invalidates
sessions and stored credentials on the side that has the old value); session-affinity assumptions (the API is
stateless — sessions live in the database — so none is needed).

## 4. Pre-deploy checklist (from `checklist.md`) — where each item stands

| # | Item | State | Evidence |
|---|---|---|---|
| 1 | Authorization / IDOR | **Done** | `pnpm test:isolation` (OpenAPI-driven cross-tenant replay, response scanning), `pnpm test:scope` (37 role/row/field checks), RBAC matrix. Found and fixed real holes — see Phase 5 in the roadmap. |
| 2 | Password-reset link TTL | **Done** | 30-minute expiry, single-use, hashed at rest, new request invalidates the old link, sessions revoked on reset. `pnpm test:auth`. |
| 3 | Input validation (SQLi/XSS) | **Done for the API; see limits** | Global `ValidationPipe` (whitelist + forbid unknown) and DTOs on every write route, tenant-reference checks, body size cap. Prisma parameterises all queries (no raw SQL with user input). React escapes output. **Limit:** the web app keeps tokens in `localStorage`, so any XSS could steal a session; there is no strict `script-src` CSP yet (only `frame-ancestors`/`base-uri`/`form-action`/`object-src`). |
| 4 | CORS locked down | **Done** | Allow-list from `WEB_URL`; production refuses to boot with a localhost/absent origin; never `*`. `pnpm test:ops`. |
| 5 | Rate limiting | **Done** | Global 100/min/IP; login 10/min, MFA verify 10/min, signup 5/min, forgot-password 5/min, reset 10/min. Verified on an instance without test overrides (11th login → 429). Per-account lockout after 5 failures (also counts wrong MFA codes). **Limit:** counters are in-process memory — with several API replicas the effective limit is per replica; use a shared store (Redis) if you scale out. |
| 6 | Error handling | **Done** | Global filter: one JSON shape, no stack/Prisma leakage, request id on every error. Web: `error.tsx`, `not-found.tsx`, `global-error.tsx`. |
| 7 | Database indexes | **Done (targeted)** | Reviewed against real query patterns; added indexes for login-by-email, manager→reports, per-user review/payslip/enrolment lookups, audit log paging, child-table FKs. Re-check with `EXPLAIN` on real data volumes. |
| 8 | Logging & monitoring | **Logging done; alerting is yours to wire** | Structured JSON access logs with request ids, `/health` + `/health/ready`. See `docs/OPERATIONS.md` for the alerts to create — this repo cannot create them. |
| 9 | Rollback strategy | **Runbook written, infra not provisioned** | §3 above. Migration baseline verified. Not rehearsed on a live cluster. |


## Single-company installation (source-code customers)

Set `SINGLE_COMPANY_MODE=true` on the API. Effects: every module is enabled with no plan; the Billing and platform screens, free trial, lapse/grace gate, payment routes (404) and AI credits (unlimited; the company supplies its own provider key) are off; public sign-up works only until the first company exists. The first sign-up creates the company and its owner (with an employee profile); everyone else joins through Settings > Staff logins. Do not set this flag on a multi-tenant deployment.


## White-label and multi-client hosting (resellers)

This is the opposite of single-company mode. One server hosts **many client companies**, all shown under the **reseller's brand**. Keep `SINGLE_COMPANY_MODE` **off**.

Set these on **both the API and the web container** (they are read at runtime; restart to apply, no rebuild):

| Variable | Meaning |
|---|---|
| `WL_PRODUCT_NAME` | Turns white-label on. The product name shown everywhere. |
| `WL_LOGO_URL` | Logo for the sign-in screen and sidebar (https URL or a data URI). Without it the name is shown as text. |
| `WL_FAVICON_URL` | Browser-tab icon. |
| `WL_PRIMARY_COLOR` | `#RRGGBB`. The whole app palette (buttons, links, focus rings) is generated from it. |
| `WL_SUPPORT_EMAIL` | Shown on receipts and used as the support address. |
| `WL_EMAIL_FROM_NAME` | Sender name on emails (defaults to the product name). The address still comes from `SMTP_FROM`. |
| `WL_WEBSITE_URL` | The reseller's site; its host is used as the company-address suffix when creating companies and for canonical links. |
| `WL_LEGAL_TEXT` | Optional line printed with the issuer on receipts. |
| `WL_CURRENCIES` | `PKR,USD` (default) or one currency. A single value bills every client in it and hides the currency switch. |

What changes when `WL_PRODUCT_NAME` is set: the vendor marketing page at `/` redirects to sign-in; page titles, share cards, the sign-in/reset/invite pages, the kiosk, the sidebar and the AI assistant (prompts and replies) use the reseller's name; invitation, reset, billing and reminder emails, the WhatsApp replies, the TOTP authenticator label and the payslip footer use it too; receipts are issued by the reseller (not the vendor) and numbered with a prefix derived from the product name; the mobile app is built with the same name and colour (`apps/mobile/app.config.js` reads the same variables at `eas build` time, plus an optional `WL_APP_ID` for the bundle id).

**Per-client logo.** In the backoffice open *Companies > (company)* and use the **Branding** card to upload that client's logo (PNG, JPEG or WebP, up to 256 KB; SVG is refused). It shows in that company's app header and on its payslips. Clients cannot change it themselves.

**Running the client book.** The reseller signs in to the backoffice (SUPER_ADMIN) and, under their own brand, creates client companies, assigns each a plan, records bank-transfer payments, and suspends or reinstates a company. Each client stays a separate tenant: data, users, logins and files are isolated exactly as on the standard multi-tenant install.

**Verifying.** `GET /api/v1/brand` returns what the server is serving. Search the rendered pages, a sent email and a payslip PDF for the vendor name before go-live; `pnpm test:qa` (spec `16-white-label`) does this automatically against a white-label API instance.


## Billing currencies (PKR for Pakistan, USD for everyone else)

- **Prices.** Every plan version and credit pack stores both a USD and a PKR price (monthly, yearly, per extra employee), set **by hand** in the backoffice (Billing > Plans and AI credit packs). There is no live FX conversion. Starting values: Starter $25 / PKR 6,999; Growth $69 / PKR 18,999; Business $149 / PKR 39,999 (+ $0.50 / PKR 140 per extra employee); yearly = 10 x monthly in both; credit packs 1k $10 / PKR 2,799, 5k $45 / PKR 12,499, 15k $120 / PKR 32,999.
- **Which currency a company pays in** is stored on the company (`Tenant.billingCurrency`), set at sign-up from the country chosen in the form (PK = PKR, everything else = USD). Companies cannot change it; the operator can (backoffice > company > Billing currency, with a reason, audited, refused while a payment is open). Companies that were already on a PKR plan become PKR on upgrade.
- **Quotes, payment references, receipts, reminder and approval emails** all use the company's currency. A company only sees, and can only pay into, **payment accounts in its own currency**: give each account a currency (PKR for a local bank / Raast, USD for Payoneer, Wise or an international bank).
- **Marketing page** (not signed in): the visitor's country comes from the `CF-IPCountry` header, else a short geo-IP lookup of the visitor's address (`GEOIP_LOOKUP=off` disables it; `GEOIP_URL` points it at your own service), else the browser time zone (Asia/Karachi = PKR). Pakistan sees PKR, everyone else USD, and a PKR/USD switch is always shown.
- Amounts are stored as exact decimals with two places (`DECIMAL(12,2)`) in each currency's major unit, and shown by one shared formatter: `PKR 18,999` (no decimals) and `$69` / `$0.50`.
- **Single-company mode** shows no prices (the price list endpoint returns 404 and the marketing pricing is hidden). Set `SINGLE_COMPANY_MODE` on the web container as well for that.

## Work-activity monitoring (disclosed)

An optional, **off-by-default** module that records work activity from a desktop agent the **employee installs themselves** from their own *My Activity* page. It records **time and activity only** — active/idle seconds, mouse and keyboard event *counts* (never which keys), and the foreground app/website name. It never records keystrokes, the screen, the clipboard, or the contents of anything opened. This is a disclosed-monitoring design on purpose: covert install, hidden operation, or recording content is out of scope and the product does not do it.

How it works end to end:
1. **HR turns it on** in *Activity Monitor → Settings*: toggle on, paste a policy (there is a template), set work hours, the offline-alert threshold, and retention (raw samples and daily summaries). Monitoring cannot be enabled without a policy. Editing the policy bumps its version and re-asks everyone to accept.
2. **The employee** opens *My Activity*, reads the policy, accepts it, then installs the agent (one-time download + run). The agent shows a **tray icon** whenever it runs. They can see everything collected about them on that page at any time, and can remove their own agent.
3. **The agent** posts batches to `POST /api/v1/activity/ingest` with header `X-Device-Token: <pairing key>` (a per-device token; only its SHA-256 is stored). A valid token carries the tenant and employee, so ingest is tenant-scoped at the door.
4. A **background job** (every 5 min; `MONITORING_WORKER=off` disables the timer, e.g. in tests) rolls raw samples into one **daily summary** per employee, raises an **AGENT_OFFLINE** alert (and notifies HR) when a paired agent goes silent during work hours — this is how HR learns an agent was quit or uninstalled — and **purges** raw samples past retention.
5. **HR and managers** see *summaries and agent status*, scoped: HR/admin see the whole company, a manager sees themselves and their direct reports, an employee sees only their own data. Settings changes and device revocations are written to the audit log.

Notes for operators:
- The native desktop agent (Windows/Mac/Linux, visible tray icon) is **phase 2**; the server pipeline, consent flow, pairing, ingest API, dashboards and alerts are complete and the install link currently serves a setup README describing the ingest contract. Point the installer at this same download link when it ships.
- There is no new environment variable required. `MONITORING_WORKER=off` only disables the periodic timer (the jobs can still be run on demand from the backoffice-side *Run maintenance* action, used by tests). Retention and work hours are per-tenant settings, not env.
- Jurisdictions this product targets (UAE, Saudi, EU staff, and increasingly Pakistan) expect notice, a stated purpose and proportionality. The consent-before-pairing flow and the employee self-view are there to satisfy that; keep monitoring disclosed.
