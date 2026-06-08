# Remove orphaned MatrixHR containers and start a fresh Docker stack.
# Usage: .\scripts\docker-reset.ps1

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..

Write-Host "==> Stopping and removing old MatrixHR containers..."
docker rm -f matrixhr-postgres matrixhr-redis matrixhr-minio 2>$null | Out-Null
docker compose down --remove-orphans 2>$null | Out-Null

Write-Host "==> Starting Docker (Postgres, Redis, MinIO)..."
docker compose up -d

Write-Host ""
Write-Host "Docker services:"
Write-Host "  Postgres  -> localhost:5432  (user: matrixhr / pass: matrixhr)"
Write-Host "  Redis     -> localhost:6379"
Write-Host "  MinIO     -> localhost:9000  (console: localhost:9001)"
Write-Host ""

docker ps --filter "name=matrixhr" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
