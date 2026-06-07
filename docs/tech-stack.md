# MatrixHR — Tech Stack

## Architecture

- **Style:** Modular monolith (NestJS) with strict module boundaries
- **Frontend:** Next.js 14 App Router (SSR)
- **Mobile:** React Native (Expo) + NativeWind
- **API:** REST + WebSocket
- **Multi-tenancy:** Single-database shared schema, `tenant_id` on every table, PostgreSQL RLS, subdomain routing (`acme.matrixhr.com`)

## Stack Table

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend Framework | NestJS (Node.js 20, TypeScript) | Modular API server |
| Database | PostgreSQL 16 | Primary transactional store |
| Cache & Queue | Redis 7 + BullMQ | Caching, sessions, background jobs |
| ORM | Prisma | Type-safe database access |
| Search | PostgreSQL full-text (MVP); Meilisearch later | Employee, document search |
| Web Frontend | Next.js 14 + Tailwind + shadcn/ui | Customer-facing web app |
| Mobile | React Native (Expo) + NativeWind | iOS + Android |
| File Storage | Cloudflare R2 / MinIO (dev) | Documents, photos, payslips |
| Email | Resend | Transactional email |
| WhatsApp | Meta WhatsApp Business Cloud API | Notifications, approvals |
| SMS Fallback | Twilio (stub) | Backup channel |
| Monitoring | Sentry | Errors |
| CI/CD | GitHub Actions | Automated testing & deployment |
| Hosting | DigitalOcean / Hetzner (Phase 1) | Application hosting |
| CDN | Cloudflare | Edge caching, DDoS protection |

## Monorepo Structure

```
matrixhr/
├── apps/
│   ├── api/          # NestJS modular monolith
│   ├── web/          # Next.js 14 App Router
│   └── mobile/       # Expo
├── packages/
│   ├── database/     # Prisma schema + migrations
│   └── shared/       # Types, validators (Zod), constants
├── docs/
└── infra/            # Docker Compose
```

## Security Baseline

- TLS 1.3, rate limiting, CSRF, CSP headers
- bcrypt password hashing, JWT 15min + refresh 7d
- AES-256 encryption at rest for files
- No secrets in repo
- Tenant isolation via RLS + application guards
- OWASP Top 10 protections

## Performance Targets

- API p95 < 300ms
- Page FCP < 1.5s
- Payroll: 1000 employees < 60s
- Uptime SLA: 99.9%
