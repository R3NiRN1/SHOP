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

Write-Host "No UTF-8 BOM detected in workspace metadata files."
