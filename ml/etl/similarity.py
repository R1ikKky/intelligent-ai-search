"""Построение customer_similarity_edge (регион + Jaccard по токенам имени + cosine категорий закупок)."""
from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

from psycopg2.extensions import cursor as Cursor
from psycopg2.extras import execute_batch

from etl.org_type import normalize_org_name


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    u = len(a | b)
    return len(a & b) / u if u else 0.0


def _cosine_counters(c1: Counter, c2: Counter) -> float:
    keys = set(c1) | set(c2)
    if not keys:
        return 0.0
    dot = sum(c1.get(k, 0) * c2.get(k, 0) for k in keys)
    n1 = math.sqrt(sum(v * v for v in c1.values()))
    n2 = math.sqrt(sum(v * v for v in c2.values()))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


def _combined_score(
    name_sim: float,
    purchase_sim: float,
    same_region: bool,
    same_org_type: bool,
) -> float:
    w = 0.32 * name_sim + 0.48 * purchase_sim
    w += 0.15 * (1.0 if same_region else 0.0)
    w += 0.05 * (1.0 if same_org_type else 0.0)
    return min(1.0, max(0.0, w))


def _name_token_set(best_name: str) -> set[str]:
    n = normalize_org_name(best_name)
    return {t for t in n.split() if len(t) > 1}


def insert_customer_similarity_edges(
    cur: Cursor,
    inns: list[str],
    best_name_by_inn: dict[str, str],
    region_by_inn: dict[str, str],
    org_primary_by_inn: dict[str, Optional[str]],
    category_counts_by_inn: dict[str, Counter],
    top_k: int = 15,
) -> int:
    """Для каждого заказчика — top_k соседей; при малом пуле в регионе — весь список."""
    if len(inns) < 2:
        return 0

    tokens_by_inn = {inn: _name_token_set(best_name_by_inn.get(inn, "")) for inn in inns}

    by_region: dict[str, list[str]] = defaultdict(list)
    for inn in inns:
        by_region[region_by_inn.get(inn, "") or ""].append(inn)

    now = datetime.now(timezone.utc)
    rows: list[tuple[Any, ...]] = []

    for src in inns:
        reg = region_by_inn.get(src, "") or ""
        pool = by_region.get(reg, []) or inns
        if len(pool) < 5:
            pool = inns

        t_src = tokens_by_inn[src]
        c_src = category_counts_by_inn.get(src, Counter())
        op_src = org_primary_by_inn.get(src)

        scored: list[tuple[float, str, float, float, bool, bool, dict[str, Any]]] = []
        for nb in pool:
            if nb == src:
                continue
            name_sim = _jaccard(t_src, tokens_by_inn.get(nb, set()))
            purchase_sim = _cosine_counters(c_src, category_counts_by_inn.get(nb, Counter()))
            r_nb = region_by_inn.get(nb, "") or ""
            same_region = (reg == r_nb) and bool(reg)
            same_org = bool(op_src and op_src == org_primary_by_inn.get(nb))
            score = _combined_score(name_sim, purchase_sim, same_region, same_org)
            feat = {
                "name_sim": name_sim,
                "purchase_sim": purchase_sim,
                "same_region": same_region,
                "same_org_type": same_org,
            }
            scored.append((score, nb, name_sim, purchase_sim, same_region, same_org, feat))

        scored.sort(key=lambda x: -x[0])
        for score, nb, ns, ps, sr, so, feat in scored[:top_k]:
            if score <= 0:
                continue
            rows.append(
                (
                    src,
                    nb,
                    float(score),
                    sr,
                    so,
                    float(ns),
                    float(ps),
                    json.dumps(feat, ensure_ascii=False),
                    now,
                )
            )

    if not rows:
        return 0

    execute_batch(
        cur,
        """INSERT INTO customer_similarity_edge (
            source_customer_data_id, neighbor_customer_data_id, similarity_score,
            same_region, same_org_type, name_similarity, purchase_similarity,
            features, computed_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s)""",
        rows,
        page_size=500,
    )
    return len(rows)
