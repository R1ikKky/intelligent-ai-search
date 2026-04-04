"""Cold-start seeds: JSON и/или upsert в customer_data_cold_start."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg2

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from etl.cold_start_profiles import build_cold_start_payloads, upsert_customer_data_cold_start


def getenv(k: str, d: str = "") -> str:
    return os.environ.get(k, d).strip()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--top-categories", type=int, default=8)
    p.add_argument("--min-edge-score", type=float, default=0.0)
    p.add_argument("-o", "--output", default="", help="JSON file (default: stdout)")
    p.add_argument(
        "--write-db",
        action="store_true",
        help="Выполнить UPSERT в customer_data_cold_start",
    )
    args = p.parse_args()

    host = getenv("POSTGRES_HOST", "localhost")
    port = getenv("POSTGRES_PORT", "5432")
    user = getenv("POSTGRES_USER", "search_user")
    pwd = getenv("POSTGRES_PASSWORD", "search_pass")
    db = getenv("POSTGRES_DB", "search_db")

    conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname=db)
    cur = conn.cursor()

    if args.write_db:
        n = upsert_customer_data_cold_start(
            cur,
            min_edge_score=float(args.min_edge_score),
            top_cat=int(args.top_categories),
        )
        conn.commit()
        print(f"Upserted {n} rows into customer_data_cold_start", file=sys.stderr)
        cur.close()
        conn.close()
        return

    payloads = build_cold_start_payloads(
        cur,
        min_edge_score=float(args.min_edge_score),
        top_cat=int(args.top_categories),
    )
    cur.execute(
        "SELECT id, org_type_primary, org_type_tags, customer_region FROM customer_data"
    )
    meta = {r[0]: {"org_type_primary": r[1], "org_type_tags": r[2] or [], "region": r[3]} for r in cur.fetchall()}

    cur.execute(
        "SELECT source_customer_data_id, count(*)::int FROM customer_similarity_edge GROUP BY 1"
    )
    edge_counts = {r[0]: int(r[1]) for r in cur.fetchall()}

    out: dict[str, dict] = {}
    for inn, pl in payloads.items():
        m = meta.get(inn, {})
        out[inn] = {
            **pl,
            "org_type_primary": m.get("org_type_primary"),
            "org_type_tags": m.get("org_type_tags"),
            "customer_region": m.get("region"),
            "similarity_edge_count": edge_counts.get(inn, 0),
        }

    text = json.dumps(out, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Wrote {len(out)} orgs to {args.output}", file=sys.stderr)
    else:
        print(text)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
