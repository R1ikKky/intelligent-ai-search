#!/usr/bin/env bash
set -euo pipefail
BASE="${ES_URL:-http://localhost:9200}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ">>> Register snapshot repo ste_fs..."
curl -sS -X PUT "$BASE/_snapshot/ste_fs" \
  -H "Content-Type: application/json" \
  --data-binary @"$DIR/es-snapshot-repo-body.json" >/dev/null

if ! curl -sS "$BASE/ste_search/_count" | grep -q '"count"'; then
  echo "Index ste_search missing. Run rebuild_ste_index first." >&2
  exit 1
fi

SNAP="ste_search_$(date +%Y%m%d_%H%M%S)"
echo ">>> Snapshot: $SNAP (may take a while)..."
curl -sS -X PUT "${BASE}/_snapshot/ste_fs/${SNAP}?wait_for_completion=true" \
  -H "Content-Type: application/json" \
  --data-binary @"$DIR/es-snapshot-create-body.json"

echo ""
echo ">>> Snapshot name: $SNAP"
if [ -d "data/elasticsearch-snapshot-repo/repo" ]; then
  ( cd data/elasticsearch-snapshot-repo && zip -r -q ../ste_search_es_snapshot.zip repo )
  echo ">>> Created data/ste_search_es_snapshot.zip (top-level folder repo/)."
else
  echo ">>> No data/elasticsearch-snapshot-repo/repo — use docker compose from this repo." >&2
fi
