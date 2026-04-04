#Requires -Version 5.1
<#
.SYNOPSIS
  Records current git diff in backend/ into _nest_patch/patches/<Name>.patch
.PARAMETER Name
  Base filename without .patch extension.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Name
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$repoRoot = Split-Path $here -Parent
$backend = Join-Path $repoRoot 'backend'
$patchesDir = Join-Path $here 'patches'
$safe = $Name -replace '[^\w\-]+', '_'
$outFile = Join-Path $patchesDir "$safe.patch"

if (-not (Test-Path $backend)) {
  Write-Error "backend/ not found: $backend"
}

if (-not (Test-Path $patchesDir)) {
  New-Item -ItemType Directory -Path $patchesDir | Out-Null
}

Push-Location $backend
try {
  & git diff --no-color | Out-File -FilePath $outFile -Encoding utf8
} finally {
  Pop-Location
}

if ((Get-Item $outFile).Length -eq 0) {
  Remove-Item $outFile -Force
  Write-Host "No diff in backend/ — empty patch not written."
  exit 1
}

Write-Host "Wrote $outFile"
Write-Host "Review the file; paths should be relative to backend/ (src/...)."
