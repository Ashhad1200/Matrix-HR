# Start full MatrixHR stack: Docker + Database + Backend + Frontend
# Usage: .\scripts\start.ps1
#        pnpm start

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "========================================"
Write-Host "  MatrixHR — Full Stack Startup"
Write-Host "========================================"
Write-Host ""

# ── 1. Docker ──────────────────────────────────────────────────────────────
Write-Host "[1/4] DOCKER — Postgres, Redis, MinIO"
& "$PSScriptRoot\docker-reset.ps1"
Start-Sleep -Seconds 3

$dbLine = 'DATABASE_URL="postgresql://matrixhr:matrixhr@localhost:5432/matrixhr?pgbouncer=true"'
if (Test-Path .env) {
    (Get-Content .env) -replace 'DATABASE_URL=.*', $dbLine | Set-Content .env
}
Set-Content packages\database\.env $dbLine

# ── 2. Database ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] DATABASE — schema push + seed"
Write-Host "==> Freeing dev ports..."
& "$PSScriptRoot\free-dev-ports.ps1"

Write-Host "==> Building shared packages..."
pnpm --filter @matrixhr/shared build
pnpm --filter @matrixhr/database build
pnpm db:generate

Write-Host "==> Pushing schema..."
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
pnpm db:push

Write-Host "==> Seeding demo data..."
pnpm db:seed

# ── 3 & 4. Backend + Frontend ────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] BACKEND  — NestJS API  -> http://localhost:3001"
Write-Host "[4/4] FRONTEND — Next.js Web -> http://localhost:3000"
Write-Host ""
Write-Host "Demo logins (password: Password123!):"
Write-Host "  Admin    admin@acme.com"
Write-Host "  Manager  ali.khan@acme.com"
Write-Host "  Employee sara.ahmed@acme.com"
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers."
Write-Host "========================================"
Write-Host ""

pnpm turbo dev --filter=@matrixhr/api --filter=@matrixhr/web
