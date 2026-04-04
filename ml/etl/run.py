"""CSV -> Postgres ETL. Env: ETL_SKIP=1 to skip.
ETL_CONTRACT_LIMIT: пусто/0 = все строки контрактов; иначе макс. принятых продаж (только СТЕ из каталога).
ETL_STE_LIMIT: пусто/0 = весь каталог СТЕ; иначе первые N уникальных id — контракты вне каталога пропускаются (без stub).
"""
from __future__ import annotations

import csv
import json
import os
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch

from etl.org_type import infer_org_type, normalize_org_name
from etl.similarity import insert_customer_similarity_edges
from etl.cold_start_profiles import upsert_customer_data_cold_start

EXPORT_CUTOFF = datetime(2026, 4, 3, tzinfo=timezone.utc)


def getenv(k: str, d: str = "") -> str:
    return os.environ.get(k, d).strip()


def parse_dt(s: str) -> datetime | None:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def parse_amount(s: str) -> Decimal:
    s = (s or "0").replace(" ", "").replace(",", ".")
    try:
        return Decimal(s)
    except Exception:
        return Decimal(0)


def parse_attrs(raw: str) -> dict:
    out: dict[str, str] = {}
    for part in (raw or "").split(";"):
        part = part.strip()
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def main() -> None:
    if getenv("ETL_SKIP", "0").lower() in ("1", "true", "yes"):
        print("ETL_SKIP set — skipping data load")
        return

    host = getenv("POSTGRES_HOST", "localhost")
    port = getenv("POSTGRES_PORT", "5432")
    user = getenv("POSTGRES_USER", "search_user")
    pwd = getenv("POSTGRES_PASSWORD", "search_pass")
    db = getenv("POSTGRES_DB", "search_db")
    data_dir = Path(getenv("DATA_DIR", "/data"))
    manifest_path = Path(getenv("MANIFEST_PATH", "/manifest/datasets.manifest.json"))
    limit_s = getenv("ETL_CONTRACT_LIMIT", "50000")
    if not limit_s or limit_s == "0":
        contract_limit = None
    else:
        contract_limit = int(limit_s)

    ste_lim_s = getenv("ETL_STE_LIMIT", "")
    if not ste_lim_s or ste_lim_s == "0":
        ste_limit: int | None = None
    else:
        ste_limit = int(ste_lim_s)
    ste_cap = ste_limit is not None

    if not manifest_path.is_file():
        print(f"Manifest not found: {manifest_path}", file=sys.stderr)
        sys.exit(1)

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    ste_name = next(x["filename"] for x in manifest["files"] if x.get("entity") == "СТЕ")
    ctr_name = next(x["filename"] for x in manifest["files"] if "Контракт" in str(x.get("entity", "")))

    ste_path = data_dir / ste_name
    ctr_path = data_dir / ctr_name
    if not ste_path.is_file() or not ctr_path.is_file():
        print(f"CSV missing: {ste_path} or {ctr_path}", file=sys.stderr)
        sys.exit(1)

    batch_id = str(uuid.uuid4())
    if contract_limit is not None:
        print(f"ETL_CONTRACT_LIMIT={contract_limit} (accepted sales cap)")
    if ste_cap:
        print(f"ETL_STE_LIMIT={ste_limit} (contracts outside catalog skipped)")

    conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname=db)
    conn.autocommit = False
    cur = conn.cursor()

    def log_issue(entity: str, key: str, code: str, payload: dict | None = None):
        cur.execute(
            """INSERT INTO etl_quality_log (batch_id, source_name, entity_name, entity_key, issue_code, issue_payload)
               VALUES (%s,%s,%s,%s,%s,%s::jsonb)""",
            (batch_id, "etl", entity, key, code, json.dumps(payload or {})),
        )

    try:
        cur.execute(
            """TRUNCATE TABLE sale, ste_supplier_stat, customer_similarity_edge,
               customer_preference_profile, customer_data_cold_start,
               customer, customer_data, ste, supplier, etl_quality_log RESTART IDENTITY CASCADE"""
        )

        # --- STE catalog (dedup first row per ste_id) ---
        seen_ste: set[str] = set()
        ste_rows: list[tuple] = []
        with open(ste_path, encoding="utf-8-sig", newline="") as f:
            r = csv.reader(f, delimiter=";")
            for row in r:
                if len(row) < 4:
                    continue
                sid, name, cat, attrs = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()
                if sid in seen_ste:
                    log_issue("ste", sid, "duplicate_row", {"name": name})
                    continue
                seen_ste.add(sid)
                aj = parse_attrs(attrs)
                search_text = " ".join([name, cat, attrs]).strip()
                ste_rows.append(
                    (
                        sid,
                        name,
                        cat,
                        attrs,
                        json.dumps(aj, ensure_ascii=False),
                        None,
                        "unknown",
                        0.0,
                        None,
                        "none",
                        "catalog",
                        search_text,
                        None,
                    )
                )
                if ste_limit is not None and len(ste_rows) >= ste_limit:
                    break

        execute_batch(
            cur,
            """INSERT INTO ste (id,name,category,attributes_raw,attributes_jsonb,manufacturer_name,manufacturer_source,
               manufacturer_confidence,id_supplier,supplier_resolution_method,source_status,search_text,embedding)
               VALUES (%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s,%s)""",
            ste_rows,
            page_size=2000,
        )
        cap_note = f" (cap={ste_limit})" if ste_limit is not None else ""
        print(f"Loaded {len(ste_rows)} STE rows{cap_note}")

        ste_category: dict[str, str] = {row[0]: row[2] for row in ste_rows}

        # --- Contracts stream ---
        cust_names: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        cust_regions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        sup_names: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        sup_regions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        cust_dates: dict[str, tuple[datetime, datetime]] = {}
        sup_dates: dict[str, tuple[datetime, datetime]] = {}
        pair_stats: dict[tuple[str, str], list] = defaultdict(lambda: [0, Decimal(0), None, None])  # cnt, amt, first, last
        sales_buf: list[tuple] = []
        stub_ste: set[str] = set()
        cust_category_counts: dict[str, Counter] = defaultdict(Counter)
        n = 0

        with open(ctr_path, encoding="utf-8-sig", newline="") as f:
            r = csv.reader(f, delimiter=";")
            for row in r:
                if contract_limit is not None and n >= contract_limit:
                    break
                if len(row) < 11:
                    continue
                title, cid, ste_id = row[0].strip(), row[1].strip(), row[2].strip()
                cdt = parse_dt(row[3])
                amt = parse_amount(row[4])
                cin, cname, creg = row[5].strip(), row[6].strip(), row[7].strip()
                sin, sname, sreg = row[8].strip(), row[9].strip(), row[10].strip()
                if not cin or not sin or not ste_id:
                    continue
                if ste_cap and ste_id not in seen_ste:
                    continue
                if cdt and cdt > EXPORT_CUTOFF:
                    log_issue("sale", cid, "future_contract_date", {"date": str(cdt)})
                if ste_id not in seen_ste:
                    stub_ste.add(ste_id)
                cust_names[cin][cname or cin] += 1
                cust_regions[cin][creg or ""] += 1
                sup_names[sin][sname or sin] += 1
                sup_regions[sin][sreg or ""] += 1
                if cdt:
                    lo, hi = cust_dates.get(cin, (cdt, cdt))
                    cust_dates[cin] = (min(lo, cdt), max(hi, cdt))
                    lo2, hi2 = sup_dates.get(sin, (cdt, cdt))
                    sup_dates[sin] = (min(lo2, cdt), max(hi2, cdt))
                st = pair_stats[(ste_id, sin)]
                st[0] += 1
                st[1] += amt
                if cdt:
                    st[2] = cdt if st[2] is None else min(st[2], cdt)
                    st[3] = cdt if st[3] is None else max(st[3], cdt)
                if not cdt:
                    cdt = datetime(1970, 1, 1, tzinfo=timezone.utc)
                cat = ste_category.get(ste_id, "unknown")
                cust_category_counts[cin][cat] += 1
                sales_buf.append((cid, ste_id, cin, sin, title, cdt, str(amt)))
                n += 1

        for ste_id in stub_ste:
            seen_ste.add(ste_id)
            search_text = f"stub {ste_id}"
            cur.execute(
                """INSERT INTO ste (id,name,category,attributes_raw,attributes_jsonb,manufacturer_name,manufacturer_source,
                   manufacturer_confidence,id_supplier,supplier_resolution_method,source_status,search_text,embedding)
                   VALUES (%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    ste_id,
                    f"Unknown STE {ste_id}",
                    "unknown",
                    "",
                    "{}",
                    None,
                    "unknown",
                    0.0,
                    None,
                    "none",
                    "contracts_stub",
                    search_text,
                    None,
                ),
            )

        for ste_id in stub_ste:
            ste_category[ste_id] = "unknown"

        now = datetime.now(timezone.utc)
        best_name_by_inn: dict[str, str] = {}
        region_by_inn: dict[str, str] = {}
        org_primary_by_inn: dict[str, str | None] = {}
        for inn, name_counts in cust_names.items():
            best_name = max(name_counts, key=lambda k: name_counts[k])
            best_reg = max(cust_regions[inn], key=lambda k: cust_regions[inn][k])
            best_name_by_inn[inn] = best_name
            region_by_inn[inn] = best_reg
            prim, tags = infer_org_type(best_name)
            org_primary_by_inn[inn] = prim
            norm = normalize_org_name(best_name)
            lo, hi = cust_dates.get(inn, (now, now))
            cur.execute(
                """INSERT INTO customer_data (id,customer_name,customer_name_normalized,customer_region,org_type_primary,
                   org_type_tags,name_embedding,name_variants,source_first_seen_at,source_last_seen_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)""",
                (
                    inn,
                    best_name,
                    norm or inn,
                    best_reg,
                    prim,
                    tags,
                    None,
                    json.dumps({k: v for k, v in name_counts.items()}, ensure_ascii=False),
                    lo,
                    hi,
                ),
            )

        for inn, name_counts in sup_names.items():
            best_name = max(name_counts, key=lambda k: name_counts[k])
            best_reg = max(sup_regions[inn], key=lambda k: sup_regions[inn][k])
            lo, hi = sup_dates.get(inn, (now, now))
            cur.execute(
                """INSERT INTO supplier (id,supplier_name,supplier_region,name_variants,region_variants,source_first_seen_at,source_last_seen_at)
                   VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)""",
                (
                    inn,
                    best_name,
                    best_reg,
                    json.dumps({k: v for k, v in name_counts.items()}, ensure_ascii=False),
                    json.dumps({k: v for k, v in sup_regions[inn].items()}, ensure_ascii=False),
                    lo,
                    hi,
                ),
            )

        if sales_buf:
            execute_batch(
                cur,
                """INSERT INTO sale (contract_id, ste_id, customer_data_id, supplier_id, procurement_title, contract_date, contract_amount)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                sales_buf,
                page_size=1000,
            )

        # ste_supplier_stat + primary supplier
        ranked: list[tuple] = []
        for (ste_id, sup_id), st in pair_stats.items():
            cnt, tot, first_d, last_d = st[0], st[1], st[2] or now, st[3] or now
            ranked.append((ste_id, sup_id, cnt, str(tot), first_d, last_d))

        by_ste: dict[str, list] = defaultdict(list)
        for t in ranked:
            by_ste[t[0]].append(t)

        for ste_id, lst in by_ste.items():
            lst.sort(
                key=lambda x: (-x[2], -Decimal(x[3]), x[5], x[1]),
            )
            for i, (sid, sup_id, cnt, tot, fd, ld) in enumerate(lst):
                cur.execute(
                    """INSERT INTO ste_supplier_stat (ste_id,supplier_id,contracts_count,contracts_total_amount,
                       first_contract_at,last_contract_at,rank_in_ste,is_primary)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (sid, sup_id, cnt, tot, fd, ld, i + 1, i == 0),
                )
            primary = lst[0][1]
            cur.execute("UPDATE ste SET id_supplier=%s, supplier_resolution_method=%s WHERE id=%s", (primary, "top_contracts", ste_id))

        inns = list(cust_names.keys())
        n_edges = insert_customer_similarity_edges(
            cur,
            inns,
            best_name_by_inn,
            region_by_inn,
            org_primary_by_inn,
            dict(cust_category_counts),
        )
        print(f"customer_similarity_edge inserted: {n_edges}")

        n_cold = upsert_customer_data_cold_start(cur)
        print(f"customer_data_cold_start upserted: {n_cold}")

        conn.commit()
        print(f"ETL done: contracts processed ~{n}, ste_supplier groups {len(by_ste)}")
    except Exception as e:
        conn.rollback()
        print(e, file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()