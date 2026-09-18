# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MatrixHR — multi-tenant SaaS HR & Payroll platform for South Asia and the Middle East. NestJS API + Next.js web + Expo mobile, PostgreSQL via Prisma.

## Commands

```bash
pnpm install                 # install all workspace deps

# Local dev (Windows-recommended path)
pnpm dev                     # scripts/start.ps1 -> docker compose up --build (Postgres, Redis, MinIO, API, Web)
pnpm docker:up               # same, foreground
pnpm docker:up:detached      # same, detached
pnpm docker:down             # docker compose down --remove-orphans
pnpm docker:reset            # scripts/docker-reset.ps1

# Per-app dev (without Docker; requires local Postgres/Redis)
pnpm dev:api                 # pnpm --filter @matrixhr/api dev   (nest build && nest start --watch)
pnpm dev:web                 # pnpm --filter @matrixhr/web dev   (next dev -p 3000)
pnpm dev:apps                # both, via turbo

pnpm build                   # turbo build (all apps/packages)
pnpm lint                    # turbo lint  (api: tsc --noEmit, web: next lint)
pnpm test                    # turbo test  (currently only apps/api has Jest specs)

# Database (packages/database, Prisma)
pnpm db:generate             # prisma generate
pnpm db:push                 # prisma db push (no migration files in dev)
pnpm db:migrate              # prisma migrate dev
pnpm db:seed                 # tsx prisma/seed.ts (creates Acme tenant + core users + calls seedBulkData for 25 employees/etc.)
pnpm db:studio               # prisma studio

# API-level smoke/RBAC tests (require the stack running on localhost:3001)
pnpm test:api                # scripts/test-apis.ts   — hits ~40 endpoints end-to-end as admin
pnpm test:rbac               # scripts/rbac-api-test.ts — role x endpoint allow/deny matrix (admin/hr/manager/employee/none)
pnpm test:ui                 # scripts/ui-test.mjs    — Playwright: login + nav smoke test per role
pnpm test:e2e                # Playwright suite in e2e/ (needs the stack + web on :3000)

# Security / feature suites (need the stack running; Acme AND Globex seeded — see packages/database/prisma/seed-globex.ts)
pnpm test:isolation          # OpenAPI-driven cross-tenant replay: no route may leak another tenant's data
pnpm test:scope              # row/field-level authorization inside a tenant + mass-assignment/foreign-key tricks
pnpm test:auth               # reset, change-password, TOTP MFA, refresh rotation, lockout (uses a throwaway tenant)
pnpm test:whatsapp           # signed webhook, consent, one-time approval codes, audit
pnpm test:ops                # health, request ids, error shapes, CORS, headers
pnpm test:offboarding        # workflow engine + offboarding
pnpm test:integrations       # credentials encryption, webhooks, ZKTeco, QuickBooks export, bank file

# Single Jest test (apps/api)
pnpm --filter @matrixhr/api test -- employees.service.spec.ts
pnpm --filter @matrixhr/api test -- -t "some test name"
```

CI (`.github/workflows/ci.yml`) runs, in order: install → `db:generate` → `db:push` → build `@matrixhr/shared` + `@matrixhr/database` → lint api → test api → build api → build web. Mirror this order when debugging a failing pipeline.

## Architecture

### Monorepo layout
- `apps/api` — NestJS modular monolith (REST, port 3001, prefix `/api/v1`)
- `apps/web` — Next.js 14 App Router (port 3000)
- `apps/mobile` — Expo/React Native (NativeWind)
- `packages/database` — Prisma schema (`prisma/schema.prisma`), seed scripts, exports `PrismaClient`/generated types/`prisma` singleton via `@matrixhr/database`
- `packages/shared` — cross-app types, Zod schemas, constants, and **the RBAC permission model** via `@matrixhr/shared`

Build order matters: `@matrixhr/shared` and `@matrixhr/database` must be generated/built before `apps/api` builds (the API imports generated Prisma types from `@matrixhr/database`). The Docker entrypoints run `pnpm db:generate` **before** building `@matrixhr/database` — if you ever reorder this, the build breaks with "no exported member" errors from `@prisma/client` because the client hasn't been generated yet.

### Multi-tenancy & RBAC — read this before touching auth/data access
- Every business table carries `tenantId`. **Tenant isolation is enforced entirely at the application layer, not the database.** `packages/database/prisma/rls-policies.sql` defines Postgres RLS policies but they are commented as "apply manually in production" and nothing in the app sets `app.tenant_id` via `SET LOCAL` — RLS is not wired in. Never assume the DB will save you: every Prisma query in a service **must** be scoped by the `tenantId` passed into it.
- The standard controller pattern: `@UseGuards(JwtAuthGuard)` at the controller level (all routes require auth), then per-route `@UseGuards(RolesGuard)` + `@Roles(UserRole.X, ...)` for role-gated routes. Pull identity via decorators in `apps/api/src/common/decorators.ts`: `@TenantId()` and `@CurrentUser('id' | 'employeeId' | ...)`, both sourced from the JWT payload attached by `JwtAuthGuard`/`jwt.strategy.ts`. Service methods take `tenantId` as an explicit first argument.
- **`packages/shared/src/permissions.ts` (`getPermissionsForRole`) is the single source of truth** for what each role (`SUPER_ADMIN`/`COMPANY_ADMIN`/`HR_MANAGER` → portal `admin`, `MANAGER` → portal `manager`, `EMPLOYEE` → portal `ess`) can see (`nav: NavItem[]`) and do (`actions: PermissionActions`). `auth.service.ts` returns this on login/`/auth/me`; the frontend renders nav purely from `user.permissions.nav` — there is no separate hardcoded frontend nav list.
- The frontend enforces route access too: `apps/web/src/components/layout/app-shell.tsx` guards every `(app)` route by checking the current pathname against `user.permissions.nav` hrefs (prefix match) and redirects to `/dashboard` if not permitted. If you add a new page, it is only reachable once its top-level path is added to the relevant role's `nav` in `permissions.ts` — don't rely on hiding the sidebar link alone.
- Backend authorization is still the real boundary (guards + `@Roles`); the frontend guard is defense-in-depth/UX, not a substitute for API-side checks.

### Data visibility rules (Phase 5) — apply when adding endpoints
- Never trust ids/`tenantId` from a request body. Use DTO classes (the global `ValidationPipe` whitelists), build the
  Prisma `data` from named fields (never `...body`), and verify client-supplied foreign keys with
  `assertInTenant(...)` from `apps/api/src/common/data-scope.ts`.
- Row scoping: `scopedEmployeeIds` / `employeeIdFilter` give "self for employees, self + reports for managers, all
  for HR+". `EmployeesService` returns a *directory* projection (no pay/ID/bank fields) to anyone below HR.
- Auth is more than a guard: object-level rules (own record, direct manager, assigned reviewer) live in services.
- `GET /auth/me` must never return credential columns; refresh tokens are matched by SHA-256, and password
  changes bump `User.tokenVersion` to revoke outstanding access tokens.
- Production refuses to boot on dev defaults (`common/production-config.ts`); see `docs/DEPLOYMENT.md`.

### API module pattern
Each business domain under `apps/api/src/<domain>/` is flat and self-contained: `<domain>.module.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `dto.ts`, `<domain>.service.spec.ts`. There are ~35 such modules (employees, leave, attendance, payroll, recruitment, performance, lms, onboarding, timesheets, reports, settings-adjacent modules like custom-fields/workflows/audit/api-keys/sso, etc.) — follow the existing module's shape when adding a new one rather than inventing a new layout.

### Web app
- Next.js App Router with route groups: `(app)/` holds the authenticated shell (dashboard and all feature pages, wrapped by `AppShell`/`AuthProvider` in `components/layout/app-shell.tsx`), while `login/`, `signup/`, `kiosk/` are standalone unauthenticated routes.
- `RoleSidebar` (`components/layout/role-sidebar.tsx`) groups nav items into fixed UI sections (Workspace/People/Time/Pay/Talent/Insights/Company) by matching hrefs from `user.permissions.nav` — it doesn't decide permissions, it only lays out whatever the backend granted.
- `apps/web/src/lib/api.ts` is a single flat `api` client object mirroring backend module boundaries (`api.employees.list()`, `api.leave.approve()`, etc.), using a bearer token read from `localStorage('accessToken')`. There's no generated client — new endpoints need a matching method added here by hand.
- Auth state lives in `context/auth-context.tsx` / `hooks/use-auth.ts`.

### Docker dev environment gotchas
- `docker/entrypoint-api.sh` and `entrypoint-web.sh` **must have LF line endings** — CRLF breaks `/bin/sh` inside the Linux containers (`set -e\r` → "Illegal option"). If Windows/git reintroduces CRLF, reconvert before debugging container crash loops.
- `node_modules` is a named Docker volume (`node_modules:/app/node_modules`), separate from the bind-mounted repo — the entrypoint only runs `pnpm install` if that volume looks empty, so a fresh volume needs one full install pass before anything builds.
- `docker-compose.yml` sets `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING` for the web/api containers — required for file-change hot reload to work at all when bind-mounting into Docker Desktop on Windows (native fs events don't reliably cross the WSL2 boundary).
- Demo/dev logins (seeded by `pnpm db:seed`): `admin@acme.com`, `hr@acme.com`, `ali.khan@acme.com` (manager), `sara.ahmed@acme.com` (employee), all password `Password123!`.
