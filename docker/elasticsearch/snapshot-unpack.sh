#!/bin/sh
set -eu
DATA_DIR="${DATA_DIR:-/data}"
OUT_DIR="${OUT_DIR:-/data/elasticsearch-snapshot-repo}"
ZIP_NAME="${ES_SNAPSHOT_ZIP:-ste_search_es_snapshot.zip}"
ZIP_PATH="${DATA_DIR}/${ZIP_NAME}"

mkdir -p "$OUT_DIR"

if [ ! -f "$ZIP_PATH" ]; then
  echo "[snapshot-unpack] Нет архива $ZIP_PATH — пропуск."
  exit 0
fi

echo "[snapshot-unpack] Распаковка $ZIP_PATH -> $OUT_DIR"
rm -rf "${OUT_DIR}/repo"
unzip -o -q "$ZIP_PATH" -d "$OUT_DIR"
echo "[snapshot-unpack] Готово."
