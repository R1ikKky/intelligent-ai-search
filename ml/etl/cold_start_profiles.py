"""Cold-start по похожим организациям → таблица customer_data_cold_start (и опционально JSON)."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from psycopg2.extensions import cursor as Cursor
from psycopg2.extras import execute_batch


def _aggregate_weighted(
    edges: dict[str, list[tuple[str, float]]],
    per_neighbor: dict[str, dict[str, float]],
    top_n: int,
) -> dict[str, dict[str, float]]:
    """Для каждого source (ИНН) — взвешенная сумма счётчиков соседей."""
    out: dict[str, dict[str, float]] = {}
    for src, nblist in edges.items():
        nblist.sort(key=lambda x: -x[1])
        agg: dict[str, float] = defaultdict(float)
        for nb, w in nblist[:20]:
            for k, v in per_neighbor.get(nb, {}).items():
                agg[k] += float(v) * w
        top = sorted(agg.items(), key=lambda x: -x[1])[:top_n]
        out[src] = {k: round(v, 4) for k, v in top}
    return out


def _own_histogram(rows: list[tuple[str, str, int]]) -> dict[str, dict[str, float]]:
    m: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for cust, key, cnt in rows:
        m[cust][key] += float(cnt)
    return {k: dict(v) for k, v in m.items()}


def build_cold_start_payloads(
    cur: Cursor,
    min_edge_score: float = 0.0,
    top_cat: int = 8,
    top_mfr: int = 8,
    top_sup: int = 8,
) -> dict[str, dict[str, Any]]:
    cur.execute(
        """
        SELECT source_customer_data_id, neighbor_customer_data_id, similarity_score
        FROM customer_similarity_edge
        WHERE similarity_score >= %s
        """,
        (float(min_edge_score),),
    )
    edges: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for src, nb, sc in cur.fetchall():
        edges[src].append((nb, float(sc)))

    cur.execute(
        """
        SELECT s.customer_data_id, st.category, COUNT(*)::int
        FROM sale s
        JOIN ste st ON st.id = s.ste_id
        GROUP BY s.customer_data_id, st.category
        """
    )
    cat_rows = cur.fetchall()
    cat_by_cust = _own_histogram([(r[0], r[1], r[2]) for r in cat_rows])
    seed_cat = _aggregate_weighted(edges, cat_by_cust, top_cat)

    cur.execute(
        """
        SELECT s.customer_data_id, COALESCE(NULLIF(trim(st.manufacturer_name), ''), '') AS mfr, COUNT(*)::int
        FROM sale s
        JOIN ste st ON st.id = s.ste_id
        GROUP BY s.customer_data_id, COALESCE(NULLIF(trim(st.manufacturer_name), ''), '')
        """
    )
    mfr_rows = [(r[0], r[1], r[2]) for r in cur.fetchall() if r[1]]
    mfr_by_cust = _own_histogram(mfr_rows)
    seed_mfr = _aggregate_weighted(edges, mfr_by_cust, top_mfr)

    cur.execute(
        """
        SELECT customer_data_id, supplier_id, COUNT(*)::int
        FROM sale
        WHERE supplier_id IS NOT NULL AND trim(supplier_id) <> ''
        GROUP BY customer_data_id, supplier_id
        """
    )
    sup_rows = [(r[0], str(r[1]), r[2]) for r in cur.fetchall()]
    sup_by_cust: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for cust, sid, cnt in sup_rows:
        sup_by_cust[cust][sid] += float(cnt)
    sup_by_cust = {k: dict(v) for k, v in sup_by_cust.items()}
    seed_sup: dict[str, dict[str, float]] = {}
    for src, nblist in edges.items():
        nblist.sort(key=lambda x: -x[1])
        agg: dict[str, float] = defaultdict(float)
        for nb, w in nblist[:20]:
            for k, v in sup_by_cust.get(nb, {}).items():
                agg[k] += float(v) * w
        top = sorted(agg.items(), key=lambda x: -x[1])[:top_sup]
        seed_sup[src] = {k: round(v, 4) for k, v in top}

    cur.execute("SELECT id FROM customer_data")
    all_inns = {r[0] for r in cur.fetchall()}

    payloads: dict[str, dict[str, Any]] = {}
    for inn in all_inns:
        similar_cat = seed_cat.get(inn, {})
        own_c = cat_by_cust.get(inn, {})
        if similar_cat:
            payloads[inn] = {
                "cold_start_seed_categories": similar_cat,
                "cold_start_seed_manufacturers": seed_mfr.get(inn, {}),
                "cold_start_seed_suppliers": seed_sup.get(inn, {}),
                "seed_source": "similar_organizations",
            }
        elif own_c:
            top_own = sorted(own_c.items(), key=lambda x: -x[1])[:top_cat]
            payloads[inn] = {
                "cold_start_seed_categories": {k: round(v, 4) for k, v in top_own},
                "cold_start_seed_manufacturers": {},
                "cold_start_seed_suppliers": {},
                "seed_source": "direct_history",
            }

    return payloads


def upsert_customer_data_cold_start(
    cur: Cursor,
    min_edge_score: float = 0.0,
    top_cat: int = 8,
    top_mfr: int = 8,
    top_sup: int = 8,
) -> int:
    payloads = build_cold_start_payloads(cur, min_edge_score, top_cat, top_mfr, top_sup)
    if not payloads:
        return 0
    now = datetime.now(timezone.utc)
    rows: list[tuple[Any, ...]] = []
    for inn, p in payloads.items():
        rows.append(
            (
                inn,
                json.dumps(p["cold_start_seed_categories"], ensure_ascii=False),
                json.dumps(p["cold_start_seed_manufacturers"], ensure_ascii=False),
                json.dumps(p["cold_start_seed_suppliers"], ensure_ascii=False),
                p["seed_source"],
                now,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO customer_data_cold_start (
            customer_data_id,
            cold_start_seed_categories,
            cold_start_seed_manufacturers,
            cold_start_seed_suppliers,
            seed_source,
            updated_at
        ) VALUES (%s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s)
        ON CONFLICT (customer_data_id) DO UPDATE SET
            cold_start_seed_categories = EXCLUDED.cold_start_seed_categories,
            cold_start_seed_manufacturers = EXCLUDED.cold_start_seed_manufacturers,
            cold_start_seed_suppliers = EXCLUDED.cold_start_seed_suppliers,
            seed_source = EXCLUDED.seed_source,
            updated_at = EXCLUDED.updated_at
        """,
        rows,
        page_size=500,
    )
    return len(rows)
