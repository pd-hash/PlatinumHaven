$ErrorActionPreference = "Stop"

$repoRoot = Join-Path $PSScriptRoot ".."
$mobileDir = Join-Path $repoRoot "PlatinumHaven"
$localProperties = Join-Path $mobileDir "local.properties"
$gradleWrapper = Join-Path $mobileDir "gradlew.bat"
$applicationId = "com.platinumhaven.app"
$launchActivity = "$applicationId/.MainActivity"

function Get-AndroidSdkPath {
    if ($env:ANDROID_SDK_ROOT) {
        return $env:ANDROID_SDK_ROOT
    }

    if ($env:ANDROID_HOME) {
        return $env:ANDROID_HOME
    }

    if (-not (Test-Path $localProperties)) {
        throw "Android SDK path not found. Expected local.properties at $localProperties"
    }

    $sdkLine = Get-Content $localProperties | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
    if (-not $sdkLine) {
        throw "Android SDK path not found in $localProperties"
    }

    $sdkPath = $sdkLine -replace '^sdk\.dir=', ''
    return $sdkPath -replace '\\:', ':' -replace '\\\\', '\'
}

function Get-ConnectedAndroidDevice {
    param(
        [string]$AdbPath
    )

    $deviceLines = & $AdbPath devices | Select-Object -Skip 1
    foreach ($line in $deviceLines) {
        if ($line -match '^\s*$') {
            continue
        }

        $parts = $line -split '\s+'
        if ($parts.Length -ge 2 -and $parts[1] -eq 'device') {
            return $parts[0]
        }
    }

    return $null
}

$sdkPath = Get-AndroidSdkPath
$adbPath = Join-Path $sdkPath "platform-tools\adb.exe"

if (-not (Test-Path $gradleWrapper)) {
    throw "Gradle wrapper not found at $gradleWrapper"
}

if (-not (Test-Path $adbPath)) {
    throw "adb not found at $adbPath"
}

$deviceId = Get-ConnectedAndroidDevice -AdbPath $adbPath
if (-not $deviceId) {
    throw "No connected Android emulator or device was found. Start one, then run the command again."
}

Write-Host "Installing Android app on device $deviceId..."
& $gradleWrapper -p $mobileDir installDebug

Write-Host "Forwarding Android localhost:5000 to the local backend..."
& $adbPath -s $deviceId reverse tcp:5000 tcp:5000 | Out-Null

Write-Host "Launching Android app on device $deviceId..."
& $adbPath -s $deviceId shell am start -n $launchActivity | Out-Null

Write-Host "Android app launched on device $deviceId"
