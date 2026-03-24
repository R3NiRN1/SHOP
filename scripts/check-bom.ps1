$ErrorActionPreference = "Stop"

$excludedPattern = "[\\/](node_modules|\\.next|\\.git|\\.turbo|dist|build)[\\/]"

$targets = Get-ChildItem -Path . -Filter package.json -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch $excludedPattern } |
  ForEach-Object { $_.FullName }

$foundBom = $false
foreach ($target in $targets) {
  $bytes = [System.IO.File]::ReadAllBytes($target)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "BOM detected: $target"
    $foundBom = $true
  }
}

if ($foundBom) {
  Write-Error "UTF-8 BOM detected. Please remove BOM from listed files."
  exit 1
}

if (-not (Test-Path "pnpm-lock.yaml")) {
  Write-Error "pnpm-lock.yaml is missing at the repository root."
  exit 1
}

$disallowedLockfiles = Get-ChildItem -Path . -Include "yarn.lock","package-lock.json" -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch $excludedPattern }

if ($disallowedLockfiles.Count -gt 0) {
  $disallowedLockfiles | ForEach-Object { Write-Host "Unexpected lockfile: $($_.FullName)" }
  Write-Error "Unexpected lockfile detected (yarn.lock or package-lock.json)."
  exit 1
}

Write-Host "Preflight checks passed."
Write-Host "No UTF-8 BOM detected in workspace metadata files."
