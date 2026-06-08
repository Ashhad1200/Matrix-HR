# Wait until Prisma can execute a query against DATABASE_URL.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$envFile = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env not found. Copy .env.example to .env first."
}

$line = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) {
    Write-Error "DATABASE_URL missing from .env"
}

$url = ($line -replace '^DATABASE_URL="?', '' -replace '"?$', '')
$hostName = "localhost"
$port = 51214
if ($url -match '@([^:/]+):(\d+)') {
    $hostName = $Matches[1]
    $port = [int]$Matches[2]
}

Write-Host "==> Waiting for database at ${hostName}:${port}..."
$dbDir = Join-Path (Get-Location) "packages\database"
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    Push-Location $dbDir
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    "SELECT 1" | pnpm exec prisma db execute --stdin --schema prisma/schema.prisma 2>$null | Out-Null
    $prismaOk = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prevEap
    Pop-Location
    if ($prismaOk) {
        Write-Host "==> Database query check passed."
        exit 0
    }
    Start-Sleep -Seconds 3
}

Write-Error "Database not reachable at ${hostName}:${port}. Run: pnpm db:start"
