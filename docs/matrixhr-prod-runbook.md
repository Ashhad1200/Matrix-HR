# MatrixHR production runbook: AI assistant, manual payments, staff logins

For the agent (or person) with SSH to the production host. Do the steps **in order** and stop at any step that says STOP.
Nothing here deletes data. Never run `prisma migrate reset`, `db push --force-reset`, or drop a table.
Never paste secrets (DB URL, API keys, SMTP password) into chat, tickets or logs.

Conventions: `$DB` = the production `DATABASE_URL` read from the API container's environment. `psql "$DB"` is read-only unless a step says otherwise.

## 1. READ-ONLY: what is production's migration state? (do this first)
```bash
psql "$DB" -c 'select migration_name, started_at, finished_at, rolled_back_at, applied_steps_count from _prisma_migrations order by started_at;'   # may say "relation does not exist": that is an answer
psql "$DB" -Atc "select table_name from information_schema.tables where table_schema='public' order by 1;" > /tmp/prod-tables.txt; wc -l /tmp/prod-tables.txt
DATABASE_URL="$DB" pnpm --filter @matrixhr/database exec tsx prisma/preflight.ts     # read-only classifier; exit 0 = safe, 2 = needs a human step, 1 = cannot connect
```
Send the three outputs to the owner. Decide:
| Result | Meaning | Action |
|---|---|---|
| `0_init` applied, no failures | normal | continue |
| no `_prisma_migrations` table, but many tables | DB was built with `db push` (P3005 on deploy) | the entrypoint baselines `0_init` automatically (`migrate resolve --applied 0_init`, never a reset). To do it by hand first: `pnpm --filter @matrixhr/database exec prisma migrate resolve --applied 0_init`. Continue. |
| a migration with `finished_at` NULL and no `rolled_back_at` | a failed migration blocks deploy (P3009) | **STOP.** Send the owner the error; do not resolve blindly. |
| `0_init` row missing but table list matches it | history mismatch | baseline as above, then continue |
| unknown migration names | DB is ahead of this code | **STOP.** |
Expected table count before: 72 to 76 (the expense/loan tables may or may not exist: the new migration creates them only if missing).

## 2. Backup (required)
```bash
pg_dump "$DB" -Fc -f /root/matrixhr-pre-ai-$(date +%F-%H%M).dump && ls -lh /root/matrixhr-pre-ai-*.dump
```
Record the file **name and size** in the report. `pg_restore --list <file> | head` must work. Without a verified dump: STOP.

## 3. Schema diff equals the reviewed one
The migration is `packages/database/prisma/migrations/1_ai_billing/migration.sql` (additive; every statement is guarded with IF NOT EXISTS or a duplicate_object block).
```bash
git diff origin/master -- packages/database/prisma/migrations | grep -iE 'DROP |TRUNCATE|DELETE FROM|ALTER COLUMN .* (TYPE|SET NOT NULL)|RENAME' && echo "STOP: destructive statement" || echo "additive only"
bash scripts/check-migration-additive.sh
```
It must print "additive only" and the script must pass. The migration was rehearsed (`scripts/migration-rehearsal.sh`) against five prod-like databases, applied twice each, with row fingerprints unchanged.

## 4. Apply the schema BEFORE the new code
```bash
DATABASE_URL="$DB" pnpm --filter @matrixhr/database exec prisma migrate deploy      # run it twice; the second run must say "No pending migrations"
DATABASE_URL="$DB" pnpm --filter @matrixhr/database exec tsx prisma/seed-usd-catalog.ts   # adds USD Starter/Growth/Business + credit packs, create-if-missing, touches nothing existing
psql "$DB" -Atc "select count(*) from information_schema.tables where table_schema='public'"   # expect 93 (the 72 + 21 new tables incl. the 4 expense/loan ones)
```
Existing tenants are untouched: no period end, so they **never lapse or see banners** until you set a renewal date in the backoffice (step 9).

## 5. Environment (Coolify), set before deploying
Required for the new features (names only here; values come from the owner's secret store):
`SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` (+ optional `SMTP_REPLY_TO`) for invites, receipts and reminders; `TRUST_PROXY=1`;
`CREDENTIAL_KEY` (already required; AI provider keys are encrypted with it); `FILE_SIGNING_KEY` (signs private file links; falls back to the JWT secret) and `API_URL` (the public API origin, used inside file links).
Do **not** set AI provider keys here: the owner pastes them in the backoffice (step 9). `AI_*_BASE_URL` must be unset in production.

## 6. Merge and deploy
Merge the PR **only when the owner says so**, then deploy from Coolify. The API entrypoint runs `migrate deploy` (already applied, so a no-op) and, on boot, removes the public-read policy from the file bucket.

## 7. Post-deploy checks
```bash
curl -fsS https://<api-host>/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://<api-host>/api/v1/billing/state            # 401 without a token
curl -s -o /dev/null -w "%{http_code}\n" https://<s3-host>/matrixhr/<any-existing-key>       # MUST be 403/404: files are private now (this is the check the local stand-in cannot do)
```
Log in as an existing company admin: no banner, no billing screen, everything as before. Open Settings > Staff logins, Settings > Leave, Billing, Ask MatrixHR.
Existing tenants need leave balances: as each company admin (or via the API with their token) `POST /api/v1/leave/balances/rebuild` once.

## 8. End-to-end with a disposable tenant (name it `ZZ-TEST`)
1. Public signup of `ZZ-TEST`: it shows a 30-day trial with 100 AI credits.
2. In the backoffice add a **payment account** (Billing > Payment accounts) if none exists.
3. As the ZZ-TEST admin: Billing > Choose plan > Starter monthly > copy the reference > upload a test image as proof.
4. As the operator: Billing > To check > open the proof > Approve. Confirm the receipt number `TVX-R-<year>-<n>` and the new period end; approve twice (no second receipt).
5. Operator sets ZZ-TEST's period end to 4 days ago (Tenants > ZZ-TEST > Billing; the grace period is 3 days): the tenant sees the lapsed, billing-only screen; request provisional access once; reject a later proof and see it end.
6. Invite a second user from Settings > Staff logins; accept the link; log in.
7. **Suspend ZZ-TEST** afterwards (Tenants > Suspend). Do not delete it.

## 9. Owner tasks (backoffice, no SSH needed)
- Billing > Payment accounts: add the real bank details (USD).
- Billing > Settings: issuer name, NTN and receipt text; confirm the grace period (3 days).
- AI assistant (backoffice): paste the OpenAI key, leave `gpt-4o-mini`, then turn the master switch **on**. Test as ZZ-TEST before announcing.
- To put an existing customer on manual renewal: Tenants > the tenant > Billing > set period end. From then on reminders (7d, 1d, expiry) and the lapse rules apply to them.

## 10. The quiet first cycle, and rollback
- For the first billing cycle watch `AiCreditLedger`, `PaymentRequest` (status PENDING for more than 2 days) and `EmailOutbox` (rows with `attempts >= 5`):
  `psql "$DB" -c "select status, count(*) from \"EmailOutbox\" group by 1"`.
- Existing tenants must show `currentPeriodEnd IS NULL` until you set it: `select count(*) from "Subscription" where "currentPeriodEnd" is null`.
- **Rollback**: the migration is additive, so rolling the *code* back is safe (old code ignores the new tables). Redeploy the previous image; do **not** drop the new tables. To stop the AI at once: backoffice master switch OFF. To stop billing banners: clear a tenant's period end.
- Restore from the step-2 dump only on the owner's instruction and only into a new database first.
