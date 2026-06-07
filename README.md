# MatrixHR

The connected HR platform built for South Asia and the Middle East.

Multi-tenant SaaS HR & Payroll — NestJS + Next.js + React Native (Expo) + PostgreSQL.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop

### Setup

```bash
# Clone and install
pnpm install

# Start infrastructure (Postgres, Redis, MinIO)
docker compose -f infra/docker-compose.yml up -d

# Copy environment
cp .env.example .env

# Generate Prisma client and push schema
pnpm db:generate
pnpm db:push

# Seed demo tenant (Acme Software)
pnpm db:seed

# Start dev servers
pnpm dev
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
