$ErrorActionPreference = "Stop"

$excludedDirs = @("node_modules", ".next", ".git", ".turbo", "dist", "build")
$excludedPattern = "[\\/](node_modules|\\.next|\\.git|\\.turbo|dist|build)[\\/]"
$toleratedErrorIds = @(
  "PathNotFound,Microsoft.PowerShell.Commands.GetChildItemCommand",
  "DirIOError,Microsoft.PowerShell.Commands.GetChildItemCommand",
  "ItemNotFoundException"
)

function Get-DirectoryEntriesSafe {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  try {
    return Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop
  }
  catch {
    if ($toleratedErrorIds -contains $_.FullyQualifiedErrorId) {
      return @()
    }

    if ($_.Exception -is [System.IO.DirectoryNotFoundException] -or $_.Exception -is [System.IO.IOException]) {
      return @()
    }

    throw
  }
}

function Get-WorkspaceFiles {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$MatchNames
  )

  $results = New-Object System.Collections.Generic.List[string]
  $stack = New-Object System.Collections.Generic.Stack[string]
  $stack.Push((Resolve-Path ".").Path)

  while ($stack.Count -gt 0) {
    $current = $stack.Pop()
    $entries = Get-DirectoryEntriesSafe -Path $current

    foreach ($entry in $entries) {
      if ($entry.PSIsContainer) {
        if ($excludedDirs -contains $entry.Name) {
          continue
        }

        $stack.Push($entry.FullName)
        continue
      }

      if ($MatchNames -contains $entry.Name -and $entry.FullName -notmatch $excludedPattern) {
        $results.Add($entry.FullName)
      }
    }
  }

  return $results
}

$targets = Get-WorkspaceFiles -MatchNames @("package.json")

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

$disallowedLockfiles = Get-WorkspaceFiles -MatchNames @("yarn.lock", "package-lock.json")

if ($disallowedLockfiles.Count -gt 0) {
  $disallowedLockfiles | ForEach-Object { Write-Host "Unexpected lockfile: $($_)" }
  Write-Error "Unexpected lockfile detected (yarn.lock or package-lock.json)."
  exit 1
}

Write-Host "Preflight checks passed."
Write-Host "No UTF-8 BOM detected in workspace metadata files."
