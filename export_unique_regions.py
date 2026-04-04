"""Собрать уникальные регионы из CSV контрактов и записать массив строк в JSON-файл.

Использование:
  python export_unique_regions.py
  python export_unique_regions.py -o ml/data/regions.json
  python export_unique_regions.py --data-dir C:/path/to/csv

По умолчанию ищет CSV с «Контракт» в имени в ml/data,
результат пишет в ml/data/unique_regions.json.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parent

    ap = argparse.ArgumentParser(description="Уникальные регионы из CSV контрактов → JSON-массив.")
    ap.add_argument(
        "-o", "--output",
        type=Path,
        default=repo_root / "ml" / "data" / "unique_regions.json",
        help="Путь к выходному JSON (по умолчанию ml/data/unique_regions.json).",
    )
    ap.add_argument(
        "--data-dir",
        type=Path,
        default=repo_root / "ml" / "data",
        help="Каталог с CSV-файлами (по умолчанию ml/data).",
    )
    args = ap.parse_args()

    data_dir: Path = args.data_dir
    if not data_dir.is_dir():
        print(f"FAIL: каталог не найден: {data_dir}", file=sys.stderr)
        return 1

    # Находим первый CSV с «Контракт» в имени
    candidates = [p for p in data_dir.iterdir() if p.suffix.lower() == ".csv" and "Контракт" in p.name]
    if not candidates:
        print(f"FAIL: CSV с «Контракт» в имени не найден в {data_dir}", file=sys.stderr)
        return 1
    csv_path = candidates[0]
    print(f"Читаю: {csv_path}")

    regions: set[str] = set()
    rows_read = 0

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=";")
        for row in reader:
            if len(row) < 11:
                continue
            rows_read += 1
            customer_region = row[7].strip()
            supplier_region = row[10].strip()
            if customer_region:
                regions.add(customer_region)
            if supplier_region:
                regions.add(supplier_region)

    result = sorted(regions)

    out_path: Path = args.output
    if not out_path.is_absolute():
        out_path = repo_root / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Строк обработано : {rows_read}")
    print(f"Уникальных регионов: {len(result)}")
    print(f"Записано в: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
