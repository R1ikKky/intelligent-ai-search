"""Комбинация лексического и семантического скора для второго прохода ранжирования."""
from __future__ import annotations


def minmax(xs: list[float]) -> list[float]:
    if not xs:
        return []
    lo, hi = min(xs), max(xs)
    if hi <= lo:
        return [0.5 for _ in xs]
    return [(x - lo) / (hi - lo) for x in xs]


def combine_lexical_semantic(
    lexical: list[float],
    semantic: list[float],
    w_semantic: float = 0.55,
) -> list[float]:
    """
    w_semantic in [0,1]; остальное на лексике.
    Оба списка одной длины; внутри min-max нормализация.
    """
    if len(lexical) != len(semantic):
        raise ValueError("lexical and semantic must have same length")
    w_semantic = max(0.0, min(1.0, w_semantic))
    w_lex = 1.0 - w_semantic
    nl = minmax(lexical)
    ns = minmax(semantic)
    return [w_lex * a + w_semantic * b for a, b in zip(nl, ns)]


def order_by_scores(ids: list[str], scores: list[float]) -> list[str]:
    pairs = sorted(zip(scores, ids), key=lambda x: -x[0])
    return [i for _, i in pairs]
