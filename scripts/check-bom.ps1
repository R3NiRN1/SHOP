$ErrorActionPreference = "Stop"

$targets = @(
  "pnpm-workspace.yaml"
)

$targets += Get-ChildItem -Path . -Filter package.json -Recurse -File |
  Where-Object { $_.FullName -notmatch "[\\/]node_modules[\\/]" } |
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

$disallowedLockfiles = Get-ChildItem -Path . -Recurse -File -Include package-lock.json, yarn.lock |
  Where-Object { $_.FullName -notmatch "[\\/]node_modules[\\/]" -and $_.FullName -notmatch "[\\/]\\.git[\\/]" -and $_.FullName -notmatch "[\\/]\\.next[\\/]" }

if ($disallowedLockfiles.Count -gt 0) {
  Write-Error "Disallowed lockfiles detected. Remove these files so pnpm-lock.yaml is the only lockfile:"
  $disallowedLockfiles | ForEach-Object { Write-Host "- $($_.FullName)" }
  exit 1
}

Write-Host "No UTF-8 BOM detected in workspace metadata files."
