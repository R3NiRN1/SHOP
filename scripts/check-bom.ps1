$ErrorActionPreference = "Stop"

$excludedDirectories = @('node_modules', '.next', '.git', '.turbo', 'dist', 'build')
$pending = [System.Collections.Generic.Stack[string]]::new()
$pending.Push((Get-Location).Path)
# Prune dependency and build trees before descending, rather than enumerating
# their contents and filtering afterwards (very slow on Windows).
$workspaceFiles = @(while ($pending.Count -gt 0) {
  foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
    if ($entry.PSIsContainer) {
      if ($entry.Name -notin $excludedDirectories -and
          -not ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        $pending.Push($entry.FullName)
      }
    } elseif ($entry.Name -in @('package.json', 'pnpm-workspace.yaml', 'yarn.lock', 'package-lock.json')) {
      $entry
    }
  }
})
$targets = $workspaceFiles |
  Where-Object { $_.Name -in @('package.json', 'pnpm-workspace.yaml') } |
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

$disallowedLockfiles = @($workspaceFiles | Where-Object { $_.Name -in @('yarn.lock', 'package-lock.json') })

if ($disallowedLockfiles.Count -gt 0) {
  $disallowedLockfiles | ForEach-Object { Write-Host "Unexpected lockfile: $($_.FullName)" }
  Write-Error "Unexpected lockfile detected (yarn.lock or package-lock.json)."
  exit 1
}

Write-Host "Preflight checks passed."
Write-Host "No UTF-8 BOM detected in workspace metadata files."
