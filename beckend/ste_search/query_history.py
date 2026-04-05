"""Нормализация и запись истории поисковых запросов."""

from __future__ import annotations

import re

from django.contrib.auth.models import AbstractBaseUser

from ste_search.models import SearchQueryHistory

_WS = re.compile(r"\s+")


def normalize_query_for_history(text: str | None) -> str:
    if not text:
        return ""
    return _WS.sub(" ", (text or "").strip().lower())


def record_search_query(user: AbstractBaseUser, query_text: str) -> None:
    raw = (query_text or "").strip()
    if not raw:
        return
    norm = normalize_query_for_history(raw)
    if not norm:
        return
    row, created = SearchQueryHistory.objects.get_or_create(
        user=user,
        normalized_query=norm,
        defaults={"query_text": raw, "use_count": 1},
    )
    if not created:
        row.query_text = raw
        row.use_count += 1
        row.save(update_fields=["query_text", "use_count", "last_used_at"])
