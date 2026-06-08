# MatrixHR

The connected HR platform built for South Asia and the Middle East.

Multi-tenant SaaS HR & Payroll — NestJS + Next.js + React Native (Expo) + PostgreSQL.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- **Database:** Docker Desktop *or* Prisma Dev (built-in local Postgres)

### Setup (Windows — recommended)

```powershell
pnpm install
.\scripts\dev.ps1
```

`dev.ps1` starts Prisma Dev if needed, pushes the schema, seeds demo data, and runs API + Web.

### Setup (Docker)

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
cp .env.example .env
# Set DATABASE_URL=postgresql://matrixhr:matrixhr@localhost:5432/matrixhr
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

**Note:** If using Prisma Dev, append `&pgbouncer=true` to `DATABASE_URL` to avoid prepared-statement errors during hot reload.

### Mock data (25 entries per module)

After the API is running:

```powershell
# Populate 25 employees, leave requests, attendance logs, jobs, courses, etc.
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/dev/seed-bulk" -Method POST

# Test all 68 API endpoints
pnpm test:api
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@acme.com | Password123! |
| HR | hr@acme.com | Password123! |
| Employee | sara.ahmed@acme.com | Password123! |

### URLs

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- MinIO Console: http://localhost:9001

## Project Structure

```
apps/
  api/       NestJS modular monolith
  web/       Next.js 14 web app
  mobile/    Expo React Native app
packages/
  database/  Prisma schema + seed
  shared/    Types, validators, constants
docs/        Product, tech stack, roadmap, pilot guide
infra/       Docker Compose
```

## Modules

- Auth & Multi-Tenancy
- Employee Database (HRIS)
- Leave Management
- Attendance & Time Tracking
- Onboarding
- WhatsApp Integration
- Payroll Engine (FBR/EOBI/PF)
- Recruitment / ATS
- Performance Management
- LMS
- Reports & Analytics
- AI (Ask MatrixHR)
- Marketplace & Integrations

## Documentation

- [Product Context](docs/product.md)
- [Tech Stack](docs/tech-stack.md)
- [Development Workflow](docs/workflow.md)
- [Roadmap](docs/roadmap.md)
- [Pilot Program](docs/pilot-program.md)
- [Year 2 Expansion](docs/year2-expansion.md)
