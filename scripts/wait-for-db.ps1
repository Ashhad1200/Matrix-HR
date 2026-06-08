# Wait until DATABASE_URL host:port accepts TCP connections.
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
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    $tcpOk = (Test-NetConnection $hostName -Port $port -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($tcpOk) {
        Write-Host "==> Database port is open; warming up..."
        Start-Sleep -Seconds 15
        exit 0
    }
    Start-Sleep -Seconds 2
}

Write-Error "Database not reachable at ${hostName}:${port}. Run: pnpm db:start"
