"""Dry-run парсинга как в etl.run. Запуск: cd ml && python -m etl.validate_dataset"""
from __future__ import annotations

import csv
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from etl.run import EXPORT_CUTOFF, parse_amount, parse_dt


def getenv(k: str, d: str = "") -> str:
    return os.environ.get(k, d).strip()


def main() -> int:
    ml_root = Path(__file__).resolve().parents[1]
    repo_root = ml_root.parent
    data_dir = Path(getenv("DATA_DIR", str(ml_root / "data")))
    manifest_path = Path(getenv("MANIFEST_PATH", str(repo_root / "datasets.manifest.json")))
    limit_s = getenv("ETL_CONTRACT_LIMIT", "50000")
    contract_limit = None if not limit_s or limit_s == "0" else int(limit_s)
    ste_lim_s = getenv("ETL_STE_LIMIT", "")
    ste_limit = None if not ste_lim_s or ste_lim_s == "0" else int(ste_lim_s)
    ste_cap = ste_limit is not None

    if not manifest_path.is_file():
        print(f"FAIL: manifest not found: {manifest_path}", file=sys.stderr)
        return 1

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    ste_name = next(x["filename"] for x in manifest["files"] if x.get("entity") == "СТЕ")
    ctr_name = next(x["filename"] for x in manifest["files"] if "Контракт" in str(x.get("entity", "")))

    ste_path = data_dir / ste_name
    ctr_path = data_dir / ctr_name
    if not ste_path.is_file() or not ctr_path.is_file():
        print(f"FAIL: CSV missing: {ste_path} | {ctr_path}", file=sys.stderr)
        return 1

    seen_ste: set[str] = set()
    ste_category: dict[str, str] = {}
    ste_rows = 0
    ste_skipped_short = 0
    ste_duplicates = 0

    with open(ste_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f, delimiter=";"):
            if len(row) < 4:
                ste_skipped_short += 1
                continue
            sid, _, cat, _ = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()
            if sid in seen_ste:
                ste_duplicates += 1
                continue
            seen_ste.add(sid)
            ste_category[sid] = cat
            ste_rows += 1
            if ste_limit is not None and ste_rows >= ste_limit:
                break

    cust_names: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    pair_stats: dict[tuple[str, str], list] = defaultdict(lambda: [0, Decimal(0), None, None])
    stub_ste: set[str] = set()
    cust_category_counts: dict[str, Counter] = defaultdict(Counter)
    ctr_skipped_short = 0
    ctr_skipped_keys = 0
    future_contract = 0
    n = 0

    with open(ctr_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f, delimiter=";"):
            if contract_limit is not None and n >= contract_limit:
                break
            if len(row) < 11:
                ctr_skipped_short += 1
                continue
            _title, cid, ste_id = row[0].strip(), row[1].strip(), row[2].strip()
            cdt = parse_dt(row[3])
            cin, cname, _creg = row[5].strip(), row[6].strip(), row[7].strip()
            sin, _sname, _sreg = row[8].strip(), row[9].strip(), row[10].strip()
            if not cin or not sin or not ste_id:
                ctr_skipped_keys += 1
                continue
            if ste_cap and ste_id not in seen_ste:
                continue
            if cdt and cdt > EXPORT_CUTOFF:
                future_contract += 1
            if ste_id not in seen_ste:
                stub_ste.add(ste_id)
            cust_names[cin][cname or cin] += 1
            st = pair_stats[(ste_id, sin)]
            st[0] += 1
            st[1] += parse_amount(row[4])
            if cdt:
                st[2] = cdt if st[2] is None else min(st[2], cdt)
                st[3] = cdt if st[3] is None else max(st[3], cdt)
            if not cdt:
                cdt = datetime(1970, 1, 1, tzinfo=timezone.utc)
            cat = ste_category.get(ste_id, "unknown")
            cust_category_counts[cin][cat] += 1
            n += 1

    ste_supplier_groups = len({k[0] for k in pair_stats})

    print("=== etl.validate_dataset (dry run, rules = etl.run) ===")
    if contract_limit is not None:
        print(f"ETL_CONTRACT_LIMIT:     {contract_limit}")
    if ste_cap:
        print(f"ETL_STE_LIMIT:          {ste_limit}")
    print(f"STE unique rows:        {ste_rows}")
    print(f"STE skipped (cols<4):   {ste_skipped_short}")
    print(f"STE duplicate id:       {ste_duplicates}")
    print(f"STE stub refs (sales):  {len(stub_ste)}")
    print(f"Sales accepted:         {n}")
    print(f"Contracts skip (cols):  {ctr_skipped_short}")
    print(f"Contracts skip (keys):  {ctr_skipped_keys}")
    print(f"Future-date (etl log):    {future_contract}")
    print(f"Unique customers:       {len(cust_names)}")
    print(f"Unique suppliers:       {len({k[1] for k in pair_stats})}")
    print(f"ste x supplier groups:  {ste_supplier_groups}")
    print()
    print("ML stage 1 checklist:")
    print(f"  [{'OK' if ste_rows > 0 else 'FAIL'}] ETL СТЕ -> ste")
    print(f"  [{'OK' if n > 0 else 'FAIL'}] ETL контракты -> sale / aggregates")
    print(f"  [{'OK' if ste_supplier_groups > 0 else 'FAIL'}] ste_supplier_stat groups")

    if ste_rows == 0 or n == 0:
        print("\nFAIL: empty STE or no sales.", file=sys.stderr)
        return 1
    print("\nPASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
