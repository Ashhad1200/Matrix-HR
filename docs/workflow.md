# MatrixHR — Development Workflow

## Git Flow

- `main` — production
- `develop` — staging
- Feature branches: `feat/leave-approval-chain`
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`

## Solo Founder + AI Cycle

1. Pick **one module slice** from roadmap
2. Write spec ticket — entities, API endpoints, acceptance criteria
3. **Schema first** — Prisma migration + RLS policy
4. **TDD** on business logic (leave accrual, attendance, payroll formulas)
5. **API → Web UI → Mobile** (in that order)
6. Integration test — tenant isolation + happy path
7. Deploy to staging — dogfood with "Acme Software" tenant
8. Weekly demo to pilot clients once live

## Definition of Done

- [ ] Prisma migration + RLS
- [ ] Unit tests for business rules
- [ ] API documented
- [ ] Audit log on mutations
- [ ] Role permission check
- [ ] i18n keys (English)
- [ ] Staging deployed

## PR Self-Review Checklist

- [ ] Tenant scope enforced on all queries
- [ ] No secrets committed
- [ ] Role guards on endpoints
- [ ] Audit log on data mutations
- [ ] Error responses follow API convention

## Local Development

```bash
# Start infrastructure
docker compose -f infra/docker-compose.yml up -d

# Install dependencies
pnpm install

# Run migrations
pnpm db:migrate

# Seed demo tenant
pnpm db:seed

# Start all apps
pnpm dev
```

## Environment Variables

Use `.env.example` files — never commit real secrets. Use Doppler or platform env injection in staging/production.
