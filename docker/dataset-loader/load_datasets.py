#!/usr/bin/env python3
"""Load trimmed datasets from CSV into Postgres."""

from __future__ import annotations

import csv
import os
import sys
import warnings
from collections import defaultdict
from collections.abc import Iterator
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import psycopg
from psycopg import sql

TARGET_CUSTOMERS = 2000
TARGET_SUPPLIERS = 500
TARGET_STE_INITIAL = 2000
STE_DATA_MIN_EXCLUSIVE = 1000
MAX_STE_ROWS = 50_000

CONTRACTS_NAME = "Контракты_20260403.csv"
STE_NAME = "СТЕ_20260403.csv"


def data_dir() -> Path:
    return Path(os.environ.get("DATA_DIR", "/data"))


def connect() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        connect_timeout=60,
    )


def _repair_customer_schema_sql() -> str:
    path = Path(__file__).resolve().parent / "repair_customer_schema.sql"
    return path.read_text(encoding="utf-8")


def _table_exists(cur: psycopg.Cursor, name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = %s",
        (name,),
    )
    return cur.fetchone() is not None


def _column_exists(cur: psycopg.Cursor, table: str, column: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = %s AND column_name = %s",
        (table, column),
    )
    return cur.fetchone() is not None


def _customer_incompatible_with_loader(cur: psycopg.Cursor) -> bool:
    """
    Django/старая схема: есть customer_data_id NOT NULL и т.п., а loader вставляет только
    (customer_inn, customer_name, customer_region).
    """
    if not _table_exists(cur, "customer"):
        return False
    if _column_exists(cur, "customer", "customer_data_id"):
        return True
    return False


def reset_loader_tables_if_incompatible(cur: psycopg.Cursor) -> None:
    """
    Сброс ETL-таблиц и при необходимости customer, если схема не совпадает с dataset-loader.

    - supplier/ste без supplier_inn: CREATE IF NOT EXISTS не чинит таблицу.
    - customer с customer_data_id и пр.: INSERT из CSV даёт NULL в NOT NULL колонках.
    """
    supplier_ste_bad = (
        _table_exists(cur, "supplier") and not _column_exists(cur, "supplier", "supplier_inn")
    ) or (
        _table_exists(cur, "ste") and not _column_exists(cur, "ste", "supplier_inn")
    )
    customer_bad = _customer_incompatible_with_loader(cur)

    if not supplier_ste_bad and not customer_bad:
        return

    reasons = []
    if supplier_ste_bad:
        reasons.append("supplier/ste без supplier_inn")
    if customer_bad:
        reasons.append("customer не под INSERT из CSV (есть customer_data_id и др.)")
    print(
        "WARNING: схема БД не совместима с dataset-loader ("
        + "; ".join(reasons)
        + "). Удаляю ste_supplier_stat, history_contract, ste_data, ste, supplier, customer…",
        flush=True,
    )
    for tbl in (
        "ste_supplier_stat",
        "history_contract",
        "ste_data",
        "ste",
        "supplier",
        "customer",
    ):
        cur.execute(sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(sql.Identifier(tbl)))


def ensure_schema(cur: psycopg.Cursor) -> None:
    reset_loader_tables_if_incompatible(cur)
    cur.execute(_repair_customer_schema_sql())
    stmts = [
        """CREATE TABLE IF NOT EXISTS supplier (
            supplier_inn TEXT PRIMARY KEY,
            supplier_name TEXT,
            supplier_region TEXT
        );""",
        """CREATE TABLE IF NOT EXISTS ste (
            ste_id TEXT PRIMARY KEY,
            ste_name TEXT,
            ste_contract_date TIMESTAMPTZ,
            ste_contract_amount NUMERIC(18, 2),
            customer_inn TEXT REFERENCES customer (customer_inn),
            supplier_inn TEXT REFERENCES supplier (supplier_inn)
        );""",
        """CREATE TABLE IF NOT EXISTS history_contract (
            id BIGSERIAL PRIMARY KEY,
            supplier_inn TEXT REFERENCES supplier (supplier_inn),
            v_ste TEXT[] NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS ste_data (
            ste_id TEXT PRIMARY KEY,
            ste_name TEXT,
            ste_category TEXT,
            ste_attributes TEXT
        );""",
    ]
    for s in stmts:
        cur.execute(s)


def parse_amount(raw: str) -> Decimal | None:
    s = raw.strip().replace(" ", "").replace("\xa0", "")
    if not s:
        return None
    s = s.replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def parse_ts(raw: str) -> datetime | None:
    s = raw.strip()
    if not s:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
        "%d.%m.%Y",
        "%d.%m.%Y %H:%M:%S",
    ):
        try:
            return datetime.strptime(s[:26], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def iter_contract_rows(path: Path) -> Iterator[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=";", quotechar='"')
        for row in reader:
            if len(row) < 11:
                continue
            yield row


def iter_ste_rows(path: Path) -> Iterator[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=";", quotechar='"')
        for row in reader:
            if len(row) < 4:
                continue
            yield row


def pass_customers_suppliers(path: Path) -> tuple[dict[str, tuple[str, str]], dict[str, tuple[str, str]]]:
    customers: dict[str, tuple[str, str]] = {}
    suppliers: dict[str, tuple[str, str]] = {}
    for row in iter_contract_rows(path):
        ci = row[5].strip()
        if ci and ci not in customers and len(customers) < TARGET_CUSTOMERS:
            customers[ci] = (row[6].strip(), row[7].strip())
        si = row[8].strip()
        if si and si not in suppliers and len(suppliers) < TARGET_SUPPLIERS:
            suppliers[si] = (row[9].strip(), row[10].strip())
        if len(customers) >= TARGET_CUSTOMERS and len(suppliers) >= TARGET_SUPPLIERS:
            break
    return customers, suppliers


def collect_ste_map(
    path: Path,
    customers: dict[str, Any],
    suppliers: dict[str, Any],
    cap: int,
) -> dict[str, dict[str, Any]]:
    ste_map: dict[str, dict[str, Any]] = {}
    for row in iter_contract_rows(path):
        if len(ste_map) >= cap:
            break
        ste_id = row[2].strip()
        if not ste_id or ste_id in ste_map:
            continue
        ci, si = row[5].strip(), row[8].strip()
        if ci not in customers or si not in suppliers:
            continue
        ste_map[ste_id] = {
            "ste_name": row[0].strip(),
            "ste_contract_date": parse_ts(row[3]),
            "ste_contract_amount": parse_amount(row[4]),
            "customer_inn": ci,
            "supplier_inn": si,
        }
    return ste_map


def count_ste_data_keys(ste_map: dict[str, Any], catalog: dict[str, Any]) -> int:
    return sum(1 for sid in ste_map if sid in catalog)


def expand_ste_for_ste_data(
    path: Path,
    customers: dict[str, Any],
    suppliers: dict[str, Any],
    ste_map: dict[str, dict[str, Any]],
    catalog: dict[str, Any],
) -> None:
    for row in iter_contract_rows(path):
        if count_ste_data_keys(ste_map, catalog) > STE_DATA_MIN_EXCLUSIVE:
            break
        if len(ste_map) >= MAX_STE_ROWS:
            break
        ste_id = row[2].strip()
        ci, si = row[5].strip(), row[8].strip()
        if not ste_id or ste_id in ste_map:
            continue
        if ci not in customers or si not in suppliers:
            continue
        ste_map[ste_id] = {
            "ste_name": row[0].strip(),
            "ste_contract_date": parse_ts(row[3]),
            "ste_contract_amount": parse_amount(row[4]),
            "customer_inn": ci,
            "supplier_inn": si,
        }


def load_ste_catalog(path: Path) -> dict[str, tuple[str, str, str]]:
    catalog: dict[str, tuple[str, str, str]] = {}
    for row in iter_ste_rows(path):
        sid = row[0].strip()
        if not sid or sid in catalog:
            continue
        catalog[sid] = (row[1].strip(), row[2].strip(), row[3].strip())
    return catalog


def pass_supplier_ste_sets(path: Path, supplier_inns: set[str]) -> dict[str, set[str]]:
    """Полный проход по файлу контрактов: для каждого supplier_inn из supplier_inns —
    множество всех ste_id из строк, где этот поставщик указан (весь датасет, не выборка)."""
    out: dict[str, set[str]] = defaultdict(set)
    for row in iter_contract_rows(path):
        si = row[8].strip()
        if si not in supplier_inns:
            continue
        st = row[2].strip()
        if st:
            out[si].add(st)
    return out


def truncate_and_load(
    conn: psycopg.Connection,
    customers: dict[str, tuple[str, str]],
    suppliers: dict[str, tuple[str, str]],
    ste_map: dict[str, dict[str, Any]],
    supplier_to_stes: dict[str, set[str]],
    ste_catalog: dict[str, tuple[str, str, str]],
) -> None:
    with conn.transaction():
        cur = conn.cursor()
        cur.execute(
            "TRUNCATE history_contract, ste_data, ste, customer, supplier RESTART IDENTITY CASCADE"
        )

        cur.executemany(
            "INSERT INTO customer (customer_inn, customer_name, customer_region) VALUES (%s, %s, %s)",
            [(inn, n, r) for inn, (n, r) in customers.items()],
        )
        cur.executemany(
            "INSERT INTO supplier (supplier_inn, supplier_name, supplier_region) VALUES (%s, %s, %s)",
            [(inn, n, r) for inn, (n, r) in suppliers.items()],
        )

        ste_rows = [
            (
                sid,
                v["ste_name"],
                v["ste_contract_date"],
                v["ste_contract_amount"],
                v["customer_inn"],
                v["supplier_inn"],
            )
            for sid, v in ste_map.items()
        ]
        cur.executemany(
            """
            INSERT INTO ste (ste_id, ste_name, ste_contract_date, ste_contract_amount, customer_inn, supplier_inn)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            ste_rows,
        )

        for si in sorted(suppliers.keys()):
            stes = sorted(supplier_to_stes.get(si, set()))
            cur.execute(
                "INSERT INTO history_contract (supplier_inn, v_ste) VALUES (%s, %s)",
                (si, stes),
            )

        ste_data_rows = [
            (sid, ste_catalog[sid][0], ste_catalog[sid][1], ste_catalog[sid][2])
            for sid in ste_map
            if sid in ste_catalog
        ]
        if ste_data_rows:
            cur.executemany(
                """
                INSERT INTO ste_data (ste_id, ste_name, ste_category, ste_attributes)
                VALUES (%s, %s, %s, %s)
                """,
                ste_data_rows,
            )


def print_table_counts(cur: psycopg.Cursor) -> None:
    tables = ("customer", "supplier", "ste", "history_contract", "ste_data")
    print("--- Загрузка: итог по таблицам ---", flush=True)
    for t in tables:
        q = sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(t))
        cur.execute(q)
        (n,) = cur.fetchone()
        print(f"  {t}: {n}", flush=True)


def main() -> int:
    base = data_dir()
    contracts_path = base / CONTRACTS_NAME
    ste_path = base / STE_NAME

    if not contracts_path.is_file() or not ste_path.is_file():
        print(
            f"WARNING: нет датасета в {base} (нужны «{CONTRACTS_NAME}» и «{STE_NAME}»). "
            "БД не заполняем.",
            file=sys.stderr,
            flush=True,
        )
        print("Загрузка не выполнялась (файлы CSV не найдены).", flush=True)
        return 0

    try:
        conn = connect()
    except Exception as e:
        print(f"ERROR: не удалось подключиться к Postgres: {e}", file=sys.stderr, flush=True)
        return 1

    try:
        with conn.cursor() as cur:
            ensure_schema(cur)
        conn.commit()

        customers, suppliers = pass_customers_suppliers(contracts_path)
        if len(customers) < TARGET_CUSTOMERS or len(suppliers) < TARGET_SUPPLIERS:
            warnings.warn(
                f"Меньше уникальных заказчиков/поставщиков, чем цель "
                f"({len(customers)}/{TARGET_CUSTOMERS}, {len(suppliers)}/{TARGET_SUPPLIERS}).",
                stacklevel=1,
            )

        ste_map = collect_ste_map(contracts_path, customers, suppliers, TARGET_STE_INITIAL)
        ste_catalog = load_ste_catalog(ste_path)

        if count_ste_data_keys(ste_map, ste_catalog) <= STE_DATA_MIN_EXCLUSIVE:
            expand_ste_for_ste_data(
                contracts_path, customers, suppliers, ste_map, ste_catalog
            )

        if count_ste_data_keys(ste_map, ste_catalog) <= STE_DATA_MIN_EXCLUSIVE:
            warnings.warn(
                f"В ste_data не больше {STE_DATA_MIN_EXCLUSIVE} строк "
                f"(сейчас {count_ste_data_keys(ste_map, ste_catalog)}).",
                stacklevel=1,
            )

        # history_contract: v_ste = все уникальные ste_id поставщика по всему CSV
        supplier_to_stes = pass_supplier_ste_sets(contracts_path, set(suppliers.keys()))

        truncate_and_load(conn, customers, suppliers, ste_map, supplier_to_stes, ste_catalog)
        conn.commit()

        with conn.cursor() as cur:
            print_table_counts(cur)

        print("--- Готово ---", flush=True)
        return 0
    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr, flush=True)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
