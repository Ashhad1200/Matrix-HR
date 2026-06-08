# MatrixHR local development startup (Windows)
# Usage: .\scripts\dev.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Building packages..."
pnpm --filter @matrixhr/shared build
pnpm --filter @matrixhr/database build
pnpm db:generate

# Prefer Docker Postgres if available, else Prisma Dev
$dockerOk = $false
try {
    $null = & docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "==> Starting Docker Postgres..."
        docker compose -f infra/docker-compose.yml up -d postgres
        $dbLine = 'DATABASE_URL="postgresql://matrixhr:matrixhr@localhost:5432/matrixhr?pgbouncer=true"'
        (Get-Content .env) -replace 'DATABASE_URL=.*', $dbLine | Set-Content .env
        Set-Content packages\database\.env $dbLine
        $dockerOk = $true
        Start-Sleep -Seconds 5
    }
} catch {}

if (-not $dockerOk) {
    Write-Host "==> Docker unavailable — using Prisma Dev..."
    $dbRunning = $false
    try {
        $result = pnpm --filter @matrixhr/database exec prisma dev ls 2>&1
        if ($result -match "running") { $dbRunning = $true }
    } catch {}

    if (-not $dbRunning) {
        $dbUrl = pnpm --filter @matrixhr/database exec prisma dev --detach -P 5432 2>&1 | Select-String "postgres://"
        if ($dbUrl) {
            $url = $dbUrl.ToString().Trim()
            if ($url -notmatch "pgbouncer=true") { $url += "&pgbouncer=true" }
            $dbLine = "DATABASE_URL=`"$url`""
            (Get-Content .env) -replace 'DATABASE_URL=.*', $dbLine | Set-Content .env
            Set-Content packages\database\.env $dbLine
            Start-Sleep -Seconds 5
        }
    }
}

Write-Host "==> Pushing schema..."
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
pnpm db:push

Write-Host "==> Seeding demo data..."
pnpm db:seed

Write-Host "==> Seeding bulk mock data (25 per entity)..."
try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/v1/dev/seed-bulk" -Method POST -ErrorAction Stop | Out-Null
} catch {
    Write-Host "    (Run after API starts: POST http://localhost:3001/api/v1/dev/seed-bulk)"
}

Write-Host "==> Starting API + Web..."
pnpm turbo dev --filter=@matrixhr/api --filter=@matrixhr/web
