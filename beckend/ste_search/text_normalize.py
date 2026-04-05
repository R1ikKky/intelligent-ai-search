"""Нормализация текста для индексации и поиска (лексика + эмбеддинги)."""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[0-9A-Za-zА-Яа-яЁё]+", re.UNICODE)
_CYR_RE = re.compile(r"[А-Яа-яЁё]")


def _normalize_enabled() -> bool:
    return os.environ.get("STE_SEARCH_NORMALIZE", "1").strip().lower() not in ("0", "false", "no")


@lru_cache(maxsize=1)
def _morph_analyzer():
    try:
        from pymorphy3 import MorphAnalyzer

        return MorphAnalyzer()
    except ImportError:
        logger.warning("pymorphy3 не установлен — только lower-case токены")
        return None


def normalize_search_text(text: str | None) -> str:
    """
    Токены: буквы/цифры; русские слова → нормальная форма (лемма); латиница → lower.
    Цифры и смешанные токены остаются в lower.
    """
    if not text or not str(text).strip():
        return ""

    if not _normalize_enabled():
        return " ".join(m.group(0).lower() for m in _TOKEN_RE.finditer(text))

    morph = _morph_analyzer()
    parts: list[str] = []
    for m in _TOKEN_RE.finditer(text):
        w = m.group(0)
        low = w.lower()
        if morph is None:
            parts.append(low)
            continue
        if _CYR_RE.search(low):
            parsed = morph.parse(low)
            lemma = parsed[0].normal_form if parsed else low
            parts.append(lemma)
        else:
            parts.append(low)
    return " ".join(parts)
