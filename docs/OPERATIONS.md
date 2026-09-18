# Operations

## Health probes

| Endpoint | Meaning | Use for |
|---|---|---|
| `GET /api/v1/health` | process is up | container liveness / restart-on-failure |
| `GET /api/v1/health/ready` | database answers within 2 s (`503` otherwise) | load-balancer target health, deploy gating |

Both are unauthenticated and exempt from rate limiting. `version` in the body is `APP_VERSION`.

## Logs

Set `NODE_ENV=production` (or `LOG_FORMAT=json`) to get **one JSON line per request** on stdout:

```json
{"level":"info","msg":"http","requestId":"…","method":"GET","path":"/api/v1/employees","status":200,"ms":12.4,"tenantId":"…","userId":"…","ip":"…"}
```

- Query strings are **never** logged (they can carry tokens). Request/response bodies are never logged.
- Every response carries `X-Request-Id`; every error body includes the same `requestId`, and 5xx errors are logged
  server-side with their stack under that id. A user quoting an id is enough to find the stack.
- An inbound `X-Request-Id` from your load balancer is honoured (if it looks sane), so traces line up end to end.
- Ship stdout to your log store (CloudWatch, Loki, Datadog…). Nothing here does that for you.

Domain audit trail: `GET /api/v1/audit/logs` (logins, password resets, MFA changes, offboarding, WhatsApp
approvals, employee changes) — tenant-scoped, HR/admin only.

## Alerts to create (not created by this repo)

Page someone for:

| Signal | Suggested threshold |
|---|---|
| `/health/ready` failing | 2 consecutive failures |
| 5xx rate (`status >= 500` log lines) | > 1 % of requests over 5 min |
| p95 `ms` | > 1500 ms over 10 min |
| Login `401`s | > 5× the 1-hour baseline (credential stuffing) |
| `429` responses | sustained spike (abuse, or a mis-set `TRUST_PROXY`) |
| Process restarts | > 2 in 10 min |

Ticket (don't page) for: webhook deliveries in `failed` state, webhooks auto-disabled (`disabledReason` set,
visible at `/settings/webhooks`), integration sync runs with status `FAILED` (Marketplace shows the last run),
disk/connection-pool saturation on Postgres.

## Backups & recovery

- Postgres: automated daily snapshots + point-in-time recovery, retention per your policy; **test a restore**
  before you need one. A snapshot is also the first step of every deploy (`docs/DEPLOYMENT.md` §3).
- MinIO/S3 (uploaded documents, generated payslip PDFs): enable versioning; back up the bucket.
- `CREDENTIAL_KEY` and `JWT_*` secrets: keep in a secrets manager, backed up separately from the database.
  Losing `CREDENTIAL_KEY` makes stored integration credentials/webhook secrets undecryptable (they'd have to be re-entered).

## Housekeeping this repo does not do yet

- **Expired sessions** accumulate in `Session` (they are ignored once expired but never deleted). Add a periodic
  `DELETE FROM "Session" WHERE "expiresAt" < now()`.
- **Old webhook deliveries / sync logs / WhatsApp messages** are kept indefinitely; add retention if volume grows.
- **Credential key rotation** has no tool (re-encrypting `TenantIntegration.accessToken/refreshToken` and
  `Webhook.secret` under a new key is a small script — not written).
- **Rate-limit state is per process** (see `DEPLOYMENT.md` §4 item 5).

## Incident quick reference

- *Users can't log in / everyone gets 429:* check `TRUST_PROXY` — all clients may be sharing the proxy's IP.
- *Webhook consumers say signatures don't match:* signature is `HMAC-SHA256(secret, timestamp + "." + rawBody)`,
  headers `X-Webhook-Timestamp` / `X-Webhook-Signature` (`sha256=…`); the secret is shown once at creation.
- *WhatsApp messages not arriving:* the API answers `503` if `WHATSAPP_APP_SECRET` is unset and `403` on a bad
  signature — check Meta's webhook delivery log. Messages to numbers without opt-in are logged as
  `blocked_no_consent` rather than sent.
- *An employee left but can still act:* offboarding completion deactivates the user and deletes sessions; existing
  access tokens die within 15 minutes at most (immediately if `status` is `INACTIVE`, which every request checks).
