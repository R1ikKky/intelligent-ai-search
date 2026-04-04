#Requires -Version 5.1
<#
.SYNOPSIS
  Applies all patches from _nest_patch/patches/*.patch into backend/ (git apply from backend root).
#>
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$repoRoot = Split-Path $here -Parent
$backend = Join-Path $repoRoot 'backend'
$patchesDir = Join-Path $here 'patches'

if (-not (Test-Path $backend)) {
  Write-Error "backend/ not found: $backend"
}

if (-not (Test-Path $patchesDir)) {
  Write-Host "No patches directory: $patchesDir"
  exit 0
}

$files = Get-ChildItem -Path $patchesDir -Filter '*.patch' -File | Sort-Object Name
if ($files.Count -eq 0) {
  Write-Host "No .patch files in patches/ — nothing to apply."
  exit 0
}

foreach ($f in $files) {
  Write-Host "Applying $($f.Name) ..."
  & git -C $backend apply --whitespace=nowarn $f.FullName
  if ($LASTEXITCODE -ne 0) {
    Write-Error "git apply failed for $($f.Name) (exit $LASTEXITCODE)"
  }
}

Write-Host "Applied $($files.Count) patch(es) to backend/."
