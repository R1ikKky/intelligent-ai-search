# Ручное восстановление из data/elasticsearch-snapshot-repo/repo (без zip).
# Для zip достаточно положить ste_search_es_snapshot.zip в data/ и выполнить docker compose up.

$ErrorActionPreference = "Stop"
$base = "http://localhost:9200"
$repoDir = "data/elasticsearch-snapshot-repo/repo"

if (-not (Test-Path $repoDir)) {
    Write-Error "Нет $repoDir. Распакуйте data/ste_search_es_snapshot.zip в data/ или запустите compose (автоимпорт)."
}

function Invoke-EsRaw($method, $path, $body) {
    if ($body) {
        curl.exe -sS -X $method "$base$path" -H "Content-Type: application/json" -d $body
    } else {
        curl.exe -sS -X $method "$base$path"
    }
}

Write-Host ">>> Регистрация репозитория ste_fs..."
Invoke-EsRaw PUT "/_snapshot/ste_fs" '{"type":"fs","settings":{"location":"repo"}}'

Write-Host "`n>>> Доступные снимки:"
Invoke-EsRaw GET "/_snapshot/ste_fs/_all"

$snap = $args[0]
if (-not $snap) {
    $snap = Read-Host "Введите имя снимка (поле snapshot из списка выше)"
}

Write-Host "`n>>> Удаление существующего индекса ste_search (если есть)..."
Invoke-EsRaw DELETE "/ste_search" | Out-Null

Write-Host ">>> Восстановление из $snap ..."
$restore = Invoke-EsRaw POST "/_snapshot/ste_fs/$snap/_restore" '{"indices":"ste_search"}'
Write-Host $restore

Write-Host "`n>>> Проверка _count:"
curl.exe -sS "$base/ste_search/_count"
