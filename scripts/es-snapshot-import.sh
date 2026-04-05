#!/usr/bin/env bash
set -euo pipefail
BASE="${ES_URL:-http://localhost:9200}"

if [[ ! -d data/elasticsearch-snapshot-repo/repo ]]; then
  echo "Нет data/elasticsearch-snapshot-repo/repo. Положите data/ste_search_es_snapshot.zip или распакуйте его." >&2
  exit 1
fi

echo ">>> Регистрация репозитория ste_fs..."
curl -sS -X PUT "$BASE/_snapshot/ste_fs" \
  -H "Content-Type: application/json" \
  -d '{"type":"fs","settings":{"location":"repo"}}'
echo ""

echo ">>> Доступные снимки:"
curl -sS "$BASE/_snapshot/ste_fs/_all"
echo ""

SNAP="${1:-}"
if [[ -z "$SNAP" ]]; then
  read -r -p "Введите имя снимка: " SNAP
fi

echo ">>> Удаление существующего индекса ste_search (если есть)..."
curl -sS -X DELETE "$BASE/ste_search" >/dev/null 2>&1 || true

echo ">>> Восстановление из $SNAP ..."
curl -sS -X POST "$BASE/_snapshot/ste_fs/$SNAP/_restore" \
  -H "Content-Type: application/json" \
  -d '{"indices":"ste_search"}'
echo ""

echo ">>> _count:"
curl -sS "$BASE/ste_search/_count"
echo ""
