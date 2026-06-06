param(
    [switch]$IncludeMobile
)

$ErrorActionPreference = "Stop"

$backendDir = Join-Path $PSScriptRoot "..\\verdant-backend"
$frontendDir = Join-Path $PSScriptRoot "..\\verdant-frontend"
$localPostgres = Join-Path $PSScriptRoot "start-local-postgres.ps1"
$androidLauncher = Join-Path $PSScriptRoot "start-android.ps1"

& $localPostgres

$backend = Start-Process -FilePath "node.exe" -ArgumentList "server.js" -WorkingDirectory $backendDir -PassThru
Write-Host "Backend started in a separate process on port 5000 (PID: $($backend.Id))"

try {
    if ($IncludeMobile) {
        & $androidLauncher
    }

    Set-Location $frontendDir
    node node_modules\vite\bin\vite.js --host 0.0.0.0
}
finally {
    if (Get-Process -Id $backend.Id -ErrorAction SilentlyContinue) {
        Stop-Process -Id $backend.Id -Force
    }
}
