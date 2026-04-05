"""Запросы к Elasticsearch: BM25 + kNN."""

from __future__ import annotations

import logging
import os
from typing import Any

from django.conf import settings
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import NotFoundError

from events.relevance import apply_multipliers_to_hits
from ste_search.card_grouping import group_hits_to_cards
from ste_search.documents import SteSearchDocument
from ste_search.embedding import encode_query
from ste_search.text_normalize import normalize_search_text

logger = logging.getLogger(__name__)


def get_es_client() -> Elasticsearch:
    url = getattr(settings, "ELASTICSEARCH_URL", "http://localhost:9200")
    if isinstance(url, str):
        hosts = [url]
    else:
        hosts = url
    return Elasticsearch(hosts=hosts, request_timeout=60)


def index_exists(client: Elasticsearch) -> bool:
    try:
        return client.indices.exists(index=SteSearchDocument.Index.name)
    except Exception:
        return False


def search_ste_cards(
    query_text: str,
    *,
    limit: int = 20,
    page: int = 1,
    user_id: int | None = None,
) -> dict[str, Any]:
    text = (query_text or "").strip()
    if not text:
        return {
            "cards": [],
            "items": [],
            "total": 0,
            "page": max(1, page),
            "limit": max(1, min(limit, 100)),
            "suggestion": None,
        }

    limit = max(1, min(int(limit), 100))
    page = max(1, int(page))
    client = get_es_client()
    idx = SteSearchDocument.Index.name

    if not index_exists(client):
        raise RuntimeError(
            f"Индекс «{idx}» отсутствует. Выполните: python manage.py rebuild_ste_index"
        )

    oversample = min(2000, max(80, limit * page * 25))
    norm_q = normalize_search_text(text) or text.lower()

    try:
        qvec = encode_query(norm_q)
    except RuntimeError as e:
        logger.warning("Поиск только по тексту (BM25), kNN отключён: %s", e)
        qvec = None

    merge_cos = float(os.environ.get("STE_SEARCH_MERGE_MIN_COSINE", "0.88"))
    hide_mfr = float(os.environ.get("STE_SEARCH_HIDE_MANUFACTURER_MIN_NORM_SCORE", "0.82"))

    bool_query = {
        "bool": {
            "should": [
                {
                    "multi_match": {
                        "query": norm_q,
                        "fields": ["search_text^4"],
                        "type": "best_fields",
                    }
                },
                {
                    "multi_match": {
                        "query": text,
                        "fields": [
                            "ste_name^3",
                            "ste_category",
                            "ste_attributes",
                        ],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                },
            ],
            "minimum_should_match": 1,
        }
    }

    try:
        search_kwargs: dict[str, Any] = {
            "index": idx,
            "size": oversample,
            "query": bool_query,
        }
        if qvec is not None:
            search_kwargs["knn"] = {
                "field": "embedding",
                "query_vector": qvec,
                "k": oversample,
                "num_candidates": min(10000, oversample * 5),
            }
        resp = client.search(**search_kwargs)
    except NotFoundError:
        raise RuntimeError(
            f"Индекс «{idx}» не найден. Выполните: python manage.py rebuild_ste_index"
        ) from None

    raw_hits: list[dict[str, Any]] = []
    for hit in resp.get("hits", {}).get("hits", []):
        src = hit.get("_source") or {}
        score = hit.get("_score")
        if score is None:
            score = 0.0
        emb = src.get("embedding")
        if not emb:
            continue
        raw_hits.append(
            {
                "ste_id": src.get("ste_id"),
                "ste_name": src.get("ste_name"),
                "ste_category": src.get("ste_category"),
                "ste_attributes": src.get("ste_attributes"),
                "supplier_inn": src.get("supplier_inn"),
                "supplier_name": src.get("supplier_name"),
                "embedding": emb,
                "_score": float(score),
            }
        )

    apply_multipliers_to_hits(raw_hits, user_id)
    cards_all = group_hits_to_cards(raw_hits, merge_cos, hide_mfr)
    total_cards = len(cards_all)
    start = (page - 1) * limit
    page_cards = cards_all[start : start + limit]

    flat_items: list[dict[str, Any]] = []
    for card in page_cards:
        mfr = card.get("manufacturer")
        for it in card["items"]:
            desc_parts = [it.get("attributes") or ""]
            if mfr and mfr.get("name"):
                desc_parts.insert(0, f"Производитель: {mfr['name']}")
            pm = float(it.get("personalizationMult", 1.0) or 1.0)
            flat_items.append(
                {
                    "id": it["steId"],
                    "externalId": it["steId"],
                    "name": it["name"],
                    "description": " | ".join(p for p in desc_parts if p).strip(),
                    "category": it.get("category") or "",
                    "unit": "",
                    "score": it["score"],
                    "personalizedScore": it["score"],
                    "isPersonalized": abs(pm - 1.0) > 1e-5,
                }
            )

    return {
        "cards": page_cards,
        "items": flat_items,
        "total": total_cards,
        "page": page,
        "limit": limit,
        "suggestion": None,
    }


def get_ste_by_id(ste_id: str) -> dict[str, Any] | None:
    """Один документ СТЕ из ES по `_id` (= ste_id)."""
    sid = (ste_id or "").strip()
    if not sid:
        return None
    client = get_es_client()
    idx = SteSearchDocument.Index.name
    if not index_exists(client):
        return None
    try:
        resp = client.get(index=idx, id=sid)
    except NotFoundError:
        return None
    except Exception:
        logger.exception("ES get_ste_by_id failed for %s", sid)
        return None
    src = resp.get("_source") or {}
    if not src.get("ste_id"):
        return None
    return {
        "steId": src.get("ste_id"),
        "name": src.get("ste_name") or "",
        "category": src.get("ste_category") or "",
        "attributes": src.get("ste_attributes") or "",
        "supplierInn": src.get("supplier_inn") or "",
        "supplierName": src.get("supplier_name") or "",
    }
