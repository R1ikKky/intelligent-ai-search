#!/bin/sh
set -eu
ES_URL="${ELASTICSEARCH_URL:-http://elasticsearch:9200}"
DATA_DIR="${DATA_DIR:-/data}"
MARKER="${DATA_DIR}/.ste_search_es_restore_done"
SNAP_DIR="${SNAP_DIR:-/snapshots}"

if [ -f "$MARKER" ]; then
  echo "[snapshot-restore] Маркер $MARKER есть — восстановление уже выполнялось. Удалите его, чтобы импортировать снова."
  exit 0
fi

if [ ! -d "${SNAP_DIR}/repo" ] || [ -z "$(ls -A "${SNAP_DIR}/repo" 2>/dev/null || true)" ]; then
  echo "[snapshot-restore] Нет данных снимка в ${SNAP_DIR}/repo — пропуск."
  exit 0
fi

echo "[snapshot-restore] Ожидание Elasticsearch..."
i=0
while ! curl -sf "${ES_URL}/_cluster/health" >/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "[snapshot-restore] Таймаут ожидания ES."
    exit 1
  fi
  sleep 2
done

echo "[snapshot-restore] Регистрация репозитория ste_fs..."
curl -sS -X PUT "${ES_URL}/_snapshot/ste_fs" \
  -H "Content-Type: application/json" \
  -d '{"type":"fs","settings":{"location":"repo"}}' >/dev/null

LIST=$(curl -sS "${ES_URL}/_snapshot/ste_fs/_all")
SNAP=$(echo "$LIST" | jq -r '(.snapshots // [])[-1].snapshot // empty')
if [ -z "$SNAP" ] || [ "$SNAP" = "null" ]; then
  echo "[snapshot-restore] В репозитории нет снимков — пропуск."
  exit 0
fi

echo "[snapshot-restore] Восстановление индекса ste_search из снимка: $SNAP"
curl -sS -X DELETE "${ES_URL}/ste_search" >/dev/null 2>&1 || true
curl -sS -X POST "${ES_URL}/_snapshot/ste_fs/${SNAP}/_restore" \
  -H "Content-Type: application/json" \
  -d '{"indices":"ste_search"}'

echo ""
# Дождаться появления индекса
sleep 3
curl -sS "${ES_URL}/ste_search/_count" || true
echo ""

touch "$MARKER"
echo "[snapshot-restore] Создан маркер $MARKER (удалите его при смене архива в data/)."
