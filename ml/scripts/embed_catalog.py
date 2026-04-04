"""Заполнение ste.embedding батчами (sentence-transformers, 384d). Запуск: python scripts/embed_catalog.py из /app (Docker ml-api)."""
from __future__ import annotations

import argparse
import os
import sys

import psycopg2
from psycopg2.extras import execute_batch
from sentence_transformers import SentenceTransformer


def getenv(k: str, d: str = "") -> str:
    return os.environ.get(k, d).strip()


def main() -> None:
    p = argparse.ArgumentParser(description="Update ste.embedding from search_text")
    p.add_argument("--batch", type=int, default=64)
    p.add_argument("--limit", type=int, default=0, help="Max STE rows (0 = all)")
    p.add_argument(
        "--only-null",
        action="store_true",
        default=True,
        help="Only rows where embedding IS NULL (default)",
    )
    p.add_argument("--all-rows", dest="only_null", action="store_false", help="Re-embed every row")
    p.add_argument(
        "--model",
        default=getenv(
            "ST_MODEL_NAME",
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        ),
    )
    args = p.parse_args()

    host = getenv("POSTGRES_HOST", "localhost")
    port = getenv("POSTGRES_PORT", "5432")
    user = getenv("POSTGRES_USER", "search_user")
    pwd = getenv("POSTGRES_PASSWORD", "search_pass")
    db = getenv("POSTGRES_DB", "search_db")

    print(f"Loading model {args.model}...", flush=True)
    model = SentenceTransformer(args.model)
    dim = model.get_sentence_embedding_dimension()
    print(f"Embedding dim={dim}", flush=True)

    conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname=db)
    cur = conn.cursor()

    q = "SELECT id, search_text FROM ste"
    if args.only_null:
        q += " WHERE embedding IS NULL"
    q += " ORDER BY id"
    if args.limit and args.limit > 0:
        q += f" LIMIT {int(args.limit)}"
    cur.execute(q)
    rows: list[tuple[str, str]] = [(r[0], r[1] or "") for r in cur.fetchall()]
    if not rows:
        print("No rows to update.", flush=True)
        return

    print(f"Encoding {len(rows)} STE rows, batch={args.batch}", flush=True)
    updates: list[tuple[list[float], str]] = []
    for i in range(0, len(rows), args.batch):
        chunk = rows[i : i + args.batch]
        texts = [t for _, t in chunk]
        emb = model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        for j, (sid, _) in enumerate(chunk):
            updates.append((emb[j].tolist(), sid))

    execute_batch(
        cur,
        "UPDATE ste SET embedding = %s::float8[] WHERE id = %s",
        updates,
        page_size=500,
    )
    conn.commit()
    cur.close()
    conn.close()
    print(f"Updated {len(updates)} rows.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
