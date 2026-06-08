# Free dev ports used by MatrixHR (node processes only).
$ports = 3000, 3001, 51213, 51214, 51215, 51216
foreach ($port in $ports) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "node") {
            Write-Host "Stopping node (PID $($proc.Id)) on port $port"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 2
