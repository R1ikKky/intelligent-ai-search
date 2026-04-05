"""Группировка попаданий ES в карточки (производитель + похожие СТЕ)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import numpy as np


def _cosine(a: list[float], b: list[float]) -> float:
    return float(np.dot(np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)))


def group_hits_to_cards(
    hits: list[dict[str, Any]],
    merge_min_cosine: float,
    hide_mfr_min_norm: float,
) -> list[dict[str, Any]]:
    """
    hits: элементы с ключами ste_id, ste_name, ste_category, ste_attributes,
    supplier_inn, supplier_name, embedding, _score.
    """
    if not hits:
        return []

    by_id: dict[str, dict[str, Any]] = {}
    for h in hits:
        sid = h["ste_id"]
        if sid not in by_id or h["_score"] > by_id[sid]["_score"]:
            by_id[sid] = h
    deduped = list(by_id.values())

    scores = [h["_score"] for h in deduped]
    lo, hi = min(scores), max(scores)
    span = hi - lo + 1e-9
    for h in deduped:
        h["_norm"] = (h["_score"] - lo) / span

    by_supplier: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for h in sorted(deduped, key=lambda x: -x["_score"]):
        by_supplier[h["supplier_inn"]].append(h)

    cards: list[dict[str, Any]] = []
    for supplier_inn, sup_hits in by_supplier.items():
        sup_hits_sorted = sorted(sup_hits, key=lambda x: -x["_score"])
        clusters: list[list[dict[str, Any]]] = []
        for h in sup_hits_sorted:
            placed = False
            for cl in clusters:
                sims = [_cosine(h["embedding"], m["embedding"]) for m in cl]
                if sims and max(sims) >= merge_min_cosine:
                    cl.append(h)
                    placed = True
                    break
            if not placed:
                clusters.append([h])

        for cl in clusters:
            cl_sorted = sorted(cl, key=lambda x: -x["_score"])
            supplier_name = cl_sorted[0].get("supplier_name") or ""
            items = []
            for x in cl_sorted:
                pm = float(x.get("_personalization_mult", 1.0) or 1.0)
                items.append(
                    {
                        "steId": x["ste_id"],
                        "name": x["ste_name"] or "",
                        "category": x["ste_category"] or "",
                        "attributes": x["ste_attributes"] or "",
                        "score": round(float(x["_score"]), 6),
                        "scoreNorm": round(float(x["_norm"]), 6),
                        "personalizationMult": round(pm, 6),
                    }
                )
            best_norm = max(i["scoreNorm"] for i in items)
            if len(items) == 1 and best_norm >= hide_mfr_min_norm:
                mfr_out = None
            else:
                mfr_out = {"inn": supplier_inn, "name": supplier_name}
            cards.append(
                {
                    "manufacturer": mfr_out,
                    "confidence": round(float(best_norm), 6),
                    "items": items,
                }
            )

    cards.sort(key=lambda c: max(i["score"] for i in c["items"]), reverse=True)
    return cards
