"""Индекс Elasticsearch для поиска СТЕ (django-elasticsearch-dsl)."""

from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry

from ste_search.models import SteSearchSource

# Поле embedding добавляется в индекс через put_mapping в rebuild_ste_index
# (корректный dense_vector в mapping даёт клиент ES, а не DEDField-обёртка).


@registry.register_document
class SteSearchDocument(Document):
    ste_id = fields.KeywordField()
    ste_name = fields.TextField()
    ste_category = fields.TextField()
    ste_attributes = fields.TextField()
    search_text = fields.TextField()
    supplier_inn = fields.KeywordField()
    supplier_name = fields.TextField()

    class Index:
        name = "ste_search"
        settings = {
            "number_of_shards": 1,
            "number_of_replicas": 0,
        }

    class Django:
        model = SteSearchSource
        ignore_signals = True
