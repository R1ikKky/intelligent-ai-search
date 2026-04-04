"""Пересборка индекса ste_search из Postgres (ste_data ∩ history_contract)."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection
from elasticsearch.helpers import bulk

from ste_search.documents import SteSearchDocument
from ste_search.embedding import encode_texts
from ste_search.search_service import get_es_client

FETCH_SQL = """
SELECT d.ste_id, d.ste_name, d.ste_category, d.ste_attributes,
       s.supplier_inn, COALESCE(sup.supplier_name, '')
FROM ste_data d
INNER JOIN ste s ON s.ste_id = d.ste_id
INNER JOIN supplier sup ON sup.supplier_inn = s.supplier_inn
WHERE d.ste_id IN (
    SELECT DISTINCT UNNEST(v_ste) FROM history_contract
)
ORDER BY d.ste_id
"""


class Command(BaseCommand):
    help = "Удаляет индекс ste_search, создаёт заново и заливает документы с эмбеддингами."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=64,
            help="Размер батча для encode (по умолчанию 64).",
        )

    def handle(self, *args, **options):
        batch_size = max(8, int(options["batch_size"]))
        client = get_es_client()
        idx = SteSearchDocument.Index.name

        with connection.cursor() as cur:
            cur.execute(FETCH_SQL)
            rows = cur.fetchall()

        if not rows:
            self.stdout.write(self.style.WARNING("Нет строк для индексации (ste_data ∩ history_contract пусто)."))
            SteSearchDocument._index.delete(ignore=[400, 404])
            SteSearchDocument.init()
            return

        self.stdout.write(f"Индексация {len(rows)} СТЕ…")

        SteSearchDocument._index.delete(ignore=[400, 404])
        SteSearchDocument.init()
        client.indices.put_mapping(
            index=idx,
            properties={
                "embedding": {
                    "type": "dense_vector",
                    "dims": 384,
                    "index": True,
                    "similarity": "cosine",
                }
            },
        )

        indexed = 0
        for start in range(0, len(rows), batch_size):
            chunk = rows[start : start + batch_size]
            texts = []
            for ste_id, name, cat, attr, _sin, _sname in chunk:
                parts = [name or "", cat or "", attr or ""]
                texts.append(" ".join(p for p in parts if p).strip() or (name or ste_id))
            vectors = encode_texts(texts, batch_size=min(batch_size, 32))

            actions = []
            for row, emb in zip(chunk, vectors):
                ste_id, name, cat, attr, sin, sname = row
                search_text = " ".join(p for p in [name or "", cat or "", attr or ""] if p).strip()
                actions.append(
                    {
                        "_op_type": "index",
                        "_index": idx,
                        "_id": ste_id,
                        "_source": {
                            "ste_id": ste_id,
                            "ste_name": name or "",
                            "ste_category": cat or "",
                            "ste_attributes": attr or "",
                            "search_text": search_text,
                            "supplier_inn": sin,
                            "supplier_name": sname or "",
                            "embedding": emb,
                        },
                    }
                )
            result = bulk(client, actions, refresh=True, raise_on_error=False)
            if isinstance(result, tuple):
                n_ok, errs = result[0], result[1] if len(result) > 1 else []
            else:
                n_ok, errs = result, []
            if errs:
                self.stdout.write(self.style.ERROR(f"Ошибки bulk: {errs[:5]}…"))
            indexed += int(n_ok)

        self.stdout.write(self.style.SUCCESS(f"Готово: проиндексировано {indexed} документов в «{idx}»."))
        client.indices.refresh(index=idx)
