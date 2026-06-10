# Full stack: kill conflicting ports + docker compose up (infra + API + Web)
# Usage: .\scripts\compose-up.ps1
#        pnpm docker:up
#        docker compose up        (after ports are free — use this script instead)

param(
    [switch]$Detached,
    [string[]]$ComposeArgs = @()
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "========================================"
Write-Host "  MatrixHR — docker compose up (full)"
Write-Host "========================================"
Write-Host ""

Write-Host "[1/3] Killing processes on ports 3000, 3001..."
& "$PSScriptRoot\free-dev-ports.ps1"

Write-Host "[2/3] Removing orphaned MatrixHR containers..."
docker rm -f matrixhr-postgres matrixhr-redis matrixhr-minio matrixhr-api matrixhr-web 2>$null | Out-Null
docker compose down --remove-orphans 2>$null | Out-Null

Write-Host "[3/3] Starting all services..."
Write-Host ""
Write-Host "  Postgres  -> localhost:5432"
Write-Host "  Redis     -> localhost:6379"
Write-Host "  MinIO     -> localhost:9000"
Write-Host "  API       -> http://localhost:3001"
Write-Host "  Web       -> http://localhost:3000"
Write-Host ""
Write-Host "Demo logins: admin@acme.com / ali.khan@acme.com / sara.ahmed@acme.com"
Write-Host "Password: Password123!"
Write-Host "========================================"
Write-Host ""

$upArgs = @("compose", "up", "--build")
if ($Detached) { $upArgs += "-d" }
if ($ComposeArgs.Length -gt 0) { $upArgs += $ComposeArgs }

& docker @upArgs
