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
