"""Оффлайн-метрики HitRate@K, MRR@K, NDCG@K по контрактам: лексический ранкер vs search_text СТЕ."""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from datetime import datetime

import psycopg2


def getenv(k: str, d: str = "") -> str:
    return os.environ.get(k, d).strip()


def tokenize(s: str) -> set[str]:
    return {t for t in re.findall(r"[\w\-]+", s.lower(), flags=re.UNICODE) if len(t) > 2}


def lex_score(q: set[str], doc: set[str]) -> float:
    if not q or not doc:
        return 0.0
    inter = len(q & doc)
    return inter / (math.sqrt(len(q)) * math.sqrt(len(doc)) + 1e-9)


def rank_for_query(
    q_tokens: set[str],
    catalog: list[tuple[str, set[str]]],
    top_n: int,
) -> list[str]:
    scored = [(lex_score(q_tokens, dt), sid) for sid, dt in catalog]
    scored.sort(key=lambda x: -x[0])
    return [sid for _, sid in scored[:top_n]]


def dcg_at_k(rels: list[float], k: int) -> float:
    s = 0.0
    for i, r in enumerate(rels[:k]):
        s += (2**r - 1) / math.log2(i + 2)
    return s


def ndcg_at_k(rels: list[float], k: int) -> float:
    ideal = sorted(rels, reverse=True)
    d = dcg_at_k(rels, k)
    di = dcg_at_k(ideal, k)
    return (d / di) if di > 0 else 0.0


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--ste-limit", type=int, default=12000, help="Max STE in index (memory)")
    p.add_argument("--test-ratio", type=float, default=0.15, help="Last fraction of timeline = test")
    p.add_argument("--k-hit", type=int, default=5)
    p.add_argument("--k-mrr", type=int, default=10)
    p.add_argument("--k-ndcg", type=int, default=10)
    p.add_argument("--max-test", type=int, default=2000, help="Cap test contracts")
    args = p.parse_args()

    host = getenv("POSTGRES_HOST", "localhost")
    port = getenv("POSTGRES_PORT", "5432")
    user = getenv("POSTGRES_USER", "search_user")
    pwd = getenv("POSTGRES_PASSWORD", "search_pass")
    db = getenv("POSTGRES_DB", "search_db")

    conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname=db)
    cur = conn.cursor()

    cur.execute(
        "SELECT id, search_text FROM ste ORDER BY id LIMIT %s",
        (int(args.ste_limit),),
    )
    catalog: list[tuple[str, set[str]]] = [(r[0], tokenize(r[1] or "")) for r in cur.fetchall()]
    ste_ids = {sid for sid, _ in catalog}

    cur.execute(
        """
        SELECT contract_id, ste_id, procurement_title, contract_date
        FROM sale
        WHERE procurement_title IS NOT NULL AND trim(procurement_title) <> ''
        ORDER BY contract_date NULLS LAST, contract_id
        """
    )
    sales_raw: list[tuple[str, str, str, datetime | None]] = []
    for r in cur.fetchall():
        cid, ste_id, title, cdt = r[0], r[1], r[2], r[3]
        if ste_id not in ste_ids:
            continue
        sales_raw.append((cid, ste_id, title, cdt))

    if len(sales_raw) < 20:
        print(json.dumps({"error": "not_enough_sales", "n": len(sales_raw)}))
        sys.exit(1)

    split_i = int(len(sales_raw) * (1.0 - args.test_ratio))
    test_rows = sales_raw[split_i : split_i + int(args.max_test)]

    hits = 0
    rr_sum = 0.0
    ndcg_sum = 0.0
    n = 0

    top_m = max(args.k_hit, args.k_mrr, args.k_ndcg, 50)

    for _cid, true_ste, title, _cdt in test_rows:
        q = tokenize(title)
        ranked = rank_for_query(q, catalog, top_m)
        n += 1
        try:
            rank = ranked.index(true_ste) + 1
        except ValueError:
            rank = None

        if rank is not None and rank <= args.k_hit:
            hits += 1
        if rank is not None and rank <= args.k_mrr:
            rr_sum += 1.0 / rank
        rels = [0.0] * min(len(ranked), args.k_ndcg)
        if rank is not None and rank <= args.k_ndcg:
            rels[rank - 1] = 1.0
        ndcg_sum += ndcg_at_k(rels, args.k_ndcg)

    out = {
        "n_test": n,
        f"hit_rate_at_{args.k_hit}": hits / n if n else 0.0,
        f"mrr_at_{args.k_mrr}": rr_sum / n if n else 0.0,
        f"ndcg_at_{args.k_ndcg}": ndcg_sum / n if n else 0.0,
        "ste_index_size": len(catalog),
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
