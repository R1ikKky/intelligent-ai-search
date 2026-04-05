# Export ste_search snapshot (ES on localhost:9200). Writes data/elasticsearch-snapshot-repo/repo and data/ste_search_es_snapshot.zip

$ErrorActionPreference = "Stop"
$base = "http://localhost:9200"
$repoDir = "data/elasticsearch-snapshot-repo/repo"
$zipOut = "data/ste_search_es_snapshot.zip"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$snapshotBodyFile = Join-Path $scriptDir "es-snapshot-create-body.json"

function Invoke-EsGet($path) {
    curl.exe -sS "$base$path"
}

Write-Host ">>> Register snapshot repo ste_fs..."
$repoBodyFile = Join-Path $scriptDir "es-snapshot-repo-body.json"
$resultReg = curl.exe -sS -X PUT "$base/_snapshot/ste_fs" -H "Content-Type: application/json" --data-binary "@$repoBodyFile"
if ($resultReg -match '"error"') { Write-Host $resultReg }

$exists = Invoke-EsGet "/ste_search/_count"
if ($exists -match '"error"') {
    Write-Error "Index ste_search missing. Run rebuild_ste_index (api with ML)."
}

$snap = "ste_search_" + (Get-Date -Format "yyyyMMdd_HHmmss")
Write-Host ">>> Creating snapshot $snap (may take a while)..."
$snapUrl = "${base}/_snapshot/ste_fs/${snap}?wait_for_completion=true"
$result = curl.exe -sS -X PUT $snapUrl -H "Content-Type: application/json" --data-binary "@$snapshotBodyFile"
Write-Host $result
if ($result -match '"error"') {
    Write-Warning "Snapshot API error (see above)."
} else {
    $deadline = (Get-Date).AddMinutes(15)
    do {
        if ($result -match '"state"\s*:\s*"SUCCESS"') { break }
        if ($result -match '"state"\s*:\s*"FAILED"') {
            Write-Warning "Snapshot FAILED"
            break
        }
        Start-Sleep -Seconds 3
        $result = curl.exe -sS "${base}/_snapshot/ste_fs/${snap}"
    } while ((Get-Date) -lt $deadline)
    if ($result -match '"state"\s*:\s*"SUCCESS"') {
        Write-Host ">>> Snapshot SUCCESS"
    } else {
        Write-Warning "Snapshot did not finish SUCCESS; see docks/elasticsearch-sharing.md"
    }
}

if (-not (Test-Path $repoDir)) {
    Write-Warning "Missing $repoDir - run Elasticsearch via docker compose from this repo."
} else {
    New-Item -ItemType Directory -Force -Path "data" | Out-Null
    if (Test-Path $zipOut) { Remove-Item -Force $zipOut }
    Write-Host ">>> Zip: $zipOut"
    Compress-Archive -Path "$repoDir" -DestinationPath $zipOut -CompressionLevel Optimal
}

Write-Host ">>> Done. Snapshot name: $snap"
