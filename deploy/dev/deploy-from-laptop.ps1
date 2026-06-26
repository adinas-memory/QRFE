param(
    [string]$SshHost = "192.168.43.142",
    [string]$SshUser = "adi",
    [int]$SshPort = 22,
    [string]$RunNumber = "",
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
if (-not $RunNumber) {
    $RunNumber = Get-Date -Format "yyyyMMddHHmmss"
}
$releaseDir = "/home/adi/releases/frontend-$RunNumber"
$sshTarget = "${SshUser}@${SshHost}"

Push-Location $RepoRoot
try {
    Write-Host "==> npm ci + build devhost (release $RunNumber)..."
    npm ci
    npm run build -- --configuration devhost
}
finally {
    Pop-Location
}

$candidates = @(
    (Join-Path $RepoRoot "dist\browser"),
    (Join-Path $RepoRoot "dist\qrfe\browser")
)
$browserDir = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browserDir) {
    throw "Build output not found. Expected dist\browser or dist\qrfe\browser"
}

$tarPath = Join-Path $env:TEMP "frontend-$RunNumber.tar.gz"
Push-Location $browserDir
try {
    tar -czf $tarPath .
}
finally {
    Pop-Location
}

Write-Host "==> Uploading bundle to $sshTarget..."
ssh -p $SshPort $sshTarget "rm -rf $releaseDir && mkdir -p $releaseDir"
scp -P $SshPort $tarPath "${sshTarget}:${releaseDir}/frontend.tar.gz"

$remoteScript = @"
set -e
cd $releaseDir
tar -xzf frontend.tar.gz
rm frontend.tar.gz
sudo rm -rf /var/www/qrfe-dev
sudo ln -sfn $releaseDir /var/www/qrfe-dev
sudo nginx -t && sudo systemctl reload nginx
"@
ssh -p $SshPort $sshTarget $remoteScript

Write-Host "==> Done. Frontend release: $releaseDir"
Write-Host "    http://$SshHost/"
