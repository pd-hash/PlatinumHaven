$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$dataDir = Join-Path $PSScriptRoot "..\.local-postgres\data"
$logFile = Join-Path $PSScriptRoot "..\.local-postgres\postgres.log"
$port = 55432

if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
    throw "Local PostgreSQL data directory was not found at $dataDir"
}

$running = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "Local PostgreSQL already running on port $port"
    exit 0
}

& "$pgBin\pg_ctl.exe" -D $dataDir -o "-p $port" -l $logFile start -w
Write-Host "Local PostgreSQL started on port $port"
