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

# Delegate to compose-up (Docker + API + Web in containers)
& "$PSScriptRoot\compose-up.ps1"
