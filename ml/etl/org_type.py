"""Нормализация наименования заказчика и эвристика org_type_primary / org_type_tags (§11.2, §7.1)."""
from __future__ import annotations

import re
from typing import Optional

# Юр. формы и шум
_LEGAL_FORMS = [
    r"\bооо\b",
    r"\bао\b",
    r"\bзао\b",
    r"\bпао\b",
    r"\bип\b",
    r"\bгбу\b",
    r"\bгу\b",
    r"\bгуп\b",
    r"\bмбу\b",
    r"\bфгбу\b",
    r"\bано\b",
    r"\bнко\b",
    r'["«»"]',
]

# (ключевые подстроки в lower name, org_type_primary, теги)
_ORG_RULES: list[tuple[list[str], str, list[str]]] = [
    (["школ", "гимназ", "лицей", "общеобразова", "начальн"], "school", ["education"]),
    (["колледж", "техникум", "училищ", "спо "], "college", ["education"]),
    (["университет", "институт", "академи"], "college", ["education", "higher_ed"]),
    (["больниц", "поликлиник", "госпитал", "медицинск"], "hospital", ["health"]),
    (["клиник", "амбулатор", "стационар"], "clinic", ["health"]),
    (["библиотек"], "library", ["culture"]),
    (["музей", "театр", "дк ", "дом культур"], "library", ["culture"]),
    (["жкх", "управляющ", "тсж", "жск", "жил"], "housing", ["housing"]),
    (["детск", "сад ", "ясл"], "school", ["education", "kindergarten"]),
    (["администрац", "министерств", "комитет", "департамент", "управлен"], "government", ["public_sector"]),
    (["фонд", "казначейств", "казна"], "government", ["public_sector", "finance"]),
    (["полици", "мвд ", "росгвард"], "government", ["security"]),
    (["спорт", "физкультур", "стадион"], "sports", ["sports"]),
]


def normalize_org_name(name: str) -> str:
    if not name:
        return ""
    t = name.lower().replace("ё", "е")
    for p in _LEGAL_FORMS:
        t = re.sub(p, " ", t, flags=re.IGNORECASE)
    t = re.sub(r"[^\w\s\-]", " ", t, flags=re.UNICODE)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def infer_org_type(name: str) -> tuple[Optional[str], list[str]]:
    """Возвращает (org_type_primary, org_type_tags)."""
    if not name:
        return None, []
    n = name.lower()
    tags: list[str] = []
    primary: Optional[str] = None
    for keywords, ptype, tt in _ORG_RULES:
        for kw in keywords:
            if kw in n:
                primary = ptype
                tags.extend(tt)
                break
        if primary:
            break
    # уникальные теги с сохранением порядка
    seen: set[str] = set()
    uniq = []
    for x in tags:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return primary, uniq
