"""Проверка индекса ste_search: число документов vs Postgres, mapping embedding, образец документа."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection

from ste_search.documents import SteSearchDocument
from ste_search.search_service import get_es_client, index_exists

COUNT_SQL = """
SELECT COUNT(*)
FROM ste_data d
INNER JOIN ste s ON s.ste_id = d.ste_id
INNER JOIN supplier sup ON sup.supplier_inn = s.supplier_inn
WHERE d.ste_id IN (
    SELECT DISTINCT UNNEST(v_ste) FROM history_contract
)
"""


class Command(BaseCommand):
    help = "Сравнивает документы в ES с выборкой из БД и проверяет поле embedding."

    def handle(self, *args, **options):
        idx = SteSearchDocument.Index.name
        client = get_es_client()

        if not index_exists(client):
            self.stdout.write(self.style.ERROR(f"Индекс «{idx}» отсутствует. Запустите: rebuild_ste_index"))
            return

        with connection.cursor() as cur:
            cur.execute(COUNT_SQL)
            (db_count,) = cur.fetchone()
        db_count = int(db_count or 0)

        es_count = int(client.count(index=idx)["count"])

        self.stdout.write(f"Postgres (ожидаемых СТЕ): {db_count}")
        self.stdout.write(f"Elasticsearch «{idx}» (документов): {es_count}")

        if db_count == es_count:
            self.stdout.write(self.style.SUCCESS("Совпадение по количеству."))
        elif db_count == 0:
            self.stdout.write(self.style.WARNING("В БД нет строк для индекса — пустой индекс ожидаем."))
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"Расхождение: пересоберите индекс командой rebuild_ste_index "
                    f"(или в БД изменились данные после индексации)."
                )
            )

        mapping = client.indices.get_mapping(index=idx)
        props = mapping.get(idx, {}).get("mappings", {}).get("properties", {})
        emb = props.get("embedding", {})
        dims = emb.get("dims")
        emb_type = emb.get("type")
        self.stdout.write(f"Mapping embedding: type={emb_type!r}, dims={dims!r} (ожидается dense_vector, 384)")

        if emb_type != "dense_vector" or dims != 384:
            self.stdout.write(self.style.ERROR("Некорректный mapping для семантического поиска."))
        else:
            self.stdout.write(self.style.SUCCESS("Mapping embedding в порядке."))

        sample = client.search(index=idx, size=1, query={"match_all": {}})
        hits = sample.get("hits", {}).get("hits", [])
        if not hits:
            self.stdout.write(self.style.WARNING("В индексе нет документов для выборки."))
            return

        src = hits[0].get("_source", {})
        e = src.get("embedding")
        if not isinstance(e, list):
            self.stdout.write(self.style.ERROR("В документе нет поля embedding (массив)."))
            return

        if len(e) != 384:
            self.stdout.write(self.style.ERROR(f"Длина вектора embedding: {len(e)}, ожидается 384."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Образец документа ste_id={src.get('ste_id')!r}, embedding из 384 чисел."))

        self.stdout.write(
            "Проверка запроса: curl -s \"http://localhost:9200/ste_search/_count\" "
            "(с хоста; в Docker замените хост на elasticsearch:9200 из контейнера api)."
        )
