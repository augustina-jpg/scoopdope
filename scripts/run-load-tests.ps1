[CmdletBinding()]
param(
    [ValidateSet('smoke', 'baseline', 'stress')]
    [string]$Profile = 'smoke',
    [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { 'http://localhost:3000' }),
    [switch]$IncludeLeaderboard
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    throw 'k6 is not installed or not available on PATH. See docs/load-testing.md for installation instructions.'
}

$healthUrl = "$($ApiUrl.TrimEnd('/'))/health/live"
try {
    $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
    if ($health.StatusCode -ne 200) {
        throw "Health check returned HTTP $($health.StatusCode)."
    }
} catch {
    throw "The API is not reachable at $healthUrl. Start the backend or pass -ApiUrl. Details: $($_.Exception.Message)"
}

$resultsDirectory = Join-Path (Get-Location) 'load-test-results'
New-Item -ItemType Directory -Force -Path $resultsDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonPath = Join-Path $resultsDirectory "api-read-only-$Profile-$timestamp.json"
$summaryPath = Join-Path $resultsDirectory "api-read-only-$Profile-$timestamp.txt"

$arguments = @(
    'run',
    '--out', "json=$jsonPath",
    '--summary-export', $summaryPath,
    '--env', "API_URL=$ApiUrl",
    '--env', "LOAD_PROFILE=$Profile"
)
if ($IncludeLeaderboard) {
    $arguments += '--env', 'INCLUDE_LEADERBOARD=true'
}
$arguments += 'scripts/load-tests/api-read-only.js'

Write-Host "Running k6 $Profile profile against $ApiUrl"
& k6 @arguments
if ($LASTEXITCODE -ne 0) {
    throw "k6 failed with exit code $LASTEXITCODE. See $summaryPath"
}

Write-Host "Results written to $jsonPath"
Write-Host "Summary written to $summaryPath"
