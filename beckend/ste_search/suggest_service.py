"""Подсказки: ES phrase suggest, лёгкий поиск по каталогу, история запросов."""

from __future__ import annotations

import logging
import unicodedata
from typing import Any

from django.contrib.auth.models import AbstractBaseUser
from django.db.models import Q

from ste_search.documents import SteSearchDocument
from ste_search.models import SearchQueryHistory
from ste_search.query_history import normalize_query_for_history
from elasticsearch import Elasticsearch

from ste_search.search_service import get_es_client, index_exists

logger = logging.getLogger(__name__)


def _norm_key(s: str) -> str:
    t = unicodedata.normalize("NFKC", (s or "").strip())
    return normalize_query_for_history(t)


def _suggestion(text: str, kind: str, score: float, flags: list[str]) -> dict[str, Any]:
    return {"text": text.strip(), "kind": kind, "score": float(score), "flags": flags}


def _parse_phrase_suggest(resp: dict[str, Any], input_norm: str, per_name: int) -> list[dict[str, Any]]:
    """Собирает варианты из всех phrase-suggest; по одному на нормализованный ключ, лучший score."""
    best: dict[str, tuple[float, str]] = {}
    suggest_block = resp.get("suggest") or {}
    for entries in suggest_block.values():
        for entry in entries or []:
            for opt in entry.get("options") or []:
                t = (opt.get("text") or "").strip()
                if not t:
                    continue
                k = _norm_key(t)
                if not k or k == input_norm:
                    continue
                sc = float(opt.get("score", 0.0))
                if k not in best or sc > best[k][0]:
                    best[k] = (sc, t)
    rows = [_suggestion(text, "spellfix", sc, ["es_phrase"]) for k, (sc, text) in best.items()]
    rows.sort(key=lambda x: -x["score"])
    return rows[:per_name]


def _catalog_hits(client: Elasticsearch, idx: str, text: str, take: int) -> list[dict[str, Any]]:
    try:
        resp = client.search(
            index=idx,
            size=take * 3,
            _source=["ste_name"],
            query={
                "bool": {
                    "should": [
                        {"match_bool_prefix": {"ste_name": {"query": text, "boost": 2.0}}},
                        {
                            "multi_match": {
                                "query": text,
                                "fields": ["ste_name^2", "ste_category"],
                                "type": "best_fields",
                                "fuzziness": "AUTO",
                            }
                        },
                    ],
                    "minimum_should_match": 1,
                }
            },
        )
    except Exception as e:
        logger.warning("suggest catalog search failed: %s", e)
        return []

    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    input_norm = _norm_key(text)
    for hit in resp.get("hits", {}).get("hits") or []:
        src = hit.get("_source") or {}
        name = (src.get("ste_name") or "").strip()
        if not name:
            continue
        k = _norm_key(name)
        if k in seen or k == input_norm:
            continue
        seen.add(k)
        rank = len(rows)
        score = max(0.1, 1.0 - rank * 0.08)
        rows.append(_suggestion(name, "catalog", score, ["ste_hit"]))
        if len(rows) >= take:
            break
    return rows


def _history_rows(user: AbstractBaseUser, text: str, take: int) -> list[dict[str, Any]]:
    norm = _norm_key(text)
    if len(norm) < 2:
        return []
    try:
        qs = (
            SearchQueryHistory.objects.filter(user=user)
            .exclude(normalized_query=norm)
            .filter(Q(normalized_query__istartswith=norm) | Q(normalized_query__icontains=norm))
            .order_by("-last_used_at")[: take * 2]
        )
    except Exception as e:
        logger.warning("suggest history query failed: %s", e)
        return []

    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for row in qs:
        t = (row.query_text or "").strip()
        k = _norm_key(t)
        if not t or k in seen or k == norm:
            continue
        seen.add(k)
        sc = min(1.0, 0.35 + 0.1 * min(row.use_count, 5))
        rows.append(_suggestion(t, "history", sc, ["pg_history"]))
        if len(rows) >= take:
            break
    return rows


def fetch_ste_suggestions(
    user: AbstractBaseUser,
    query_text: str,
    *,
    limit: int = 10,
) -> list[dict[str, Any]]:
    text = (query_text or "").strip()
    if not text:
        return []

    limit = max(3, min(int(limit), 20))
    per_bucket = max(2, (limit + 2) // 3)
    client = get_es_client()
    idx = SteSearchDocument.Index.name
    input_norm = _norm_key(text)

    spell: list[dict[str, Any]] = []
    catalog: list[dict[str, Any]] = []

    if index_exists(client):
        try:
            resp = client.search(
                index=idx,
                size=0,
                suggest={
                    "phrase_ste_name": {
                        "text": text,
                        "phrase": {
                            "field": "ste_name",
                            "size": per_bucket,
                            "gram_size": 2,
                            "max_errors": 2.0,
                            "confidence": 0.88,
                            "direct_generator": [
                                {
                                    "field": "ste_name",
                                    "suggest_mode": "popular",
                                    "min_word_length": 2,
                                }
                            ],
                        },
                    },
                    "phrase_search_text": {
                        "text": text,
                        "phrase": {
                            "field": "search_text",
                            "size": per_bucket,
                            "max_errors": 2.0,
                            "confidence": 0.85,
                            "direct_generator": [
                                {
                                    "field": "search_text",
                                    "suggest_mode": "popular",
                                    "min_word_length": 2,
                                }
                            ],
                        },
                    },
                },
            )
            spell = _parse_phrase_suggest(resp, input_norm, per_bucket * 2)
        except Exception as e:
            logger.warning("suggest phrase ES failed: %s", e)

        catalog = _catalog_hits(client, idx, text, per_bucket)

    hist = _history_rows(user, text, per_bucket)

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_rows(rows: list[dict[str, Any]]) -> None:
        for r in rows:
            k = _norm_key(r["text"])
            if k in seen:
                continue
            seen.add(k)
            merged.append(r)
            if len(merged) >= limit:
                return

    add_rows(spell)
    if len(merged) < limit:
        add_rows(hist)
    if len(merged) < limit:
        add_rows(catalog)

    return _dedupe_by_norm_preserve_order(merged[:limit])


def _dedupe_by_norm_preserve_order(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Убирает повторы с одинаковым смыслом текста (после NFKC + lower + пробелы)."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for r in rows:
        k = _norm_key(r.get("text") or "")
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out
