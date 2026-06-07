# MatrixHR Security Checklist (Pre-Pilot)

## Application Security

- [x] Helmet security headers (API)
- [x] Rate limiting (100 req/min via Throttler)
- [x] bcrypt password hashing (12 rounds)
- [x] JWT access (15min) + refresh (7d) tokens
- [x] Account lockout after 5 failed attempts
- [x] Input validation (class-validator + Zod schemas)
- [x] CORS restricted to WEB_URL
- [x] Tenant scoping on all queries (tenantId from JWT)

## Data Isolation

- [x] tenant_id on all business tables
- [x] JWT carries tenantId, validated on every request
- [x] API guards enforce tenant scope
- [ ] PostgreSQL RLS policies (application-level isolation implemented; RLS optional enhancement)

## Audit

- [x] Immutable audit log on auth events
- [x] Audit log on employee CRUD
- [x] WhatsApp message log

## Accessibility (WCAG 2.1 AA)

- [x] Semantic HTML structure
- [x] Focus visible states on interactive elements
- [x] aria-label on theme toggle
- [x] Color contrast in light/dark modes
- [ ] Full screen reader audit (manual step before pilot)

## Pre-Production

- [ ] Rotate all secrets (JWT, DB, S3)
- [ ] Enable TLS via Cloudflare
- [ ] Penetration test
- [ ] Dependency audit (pnpm audit)
