"""Чтение мультипликаторов релевантности для поиска."""

from __future__ import annotations

from typing import Any

from django.utils import timezone

from events.models import UserSteDayPenalty, UserSteRelevanceModifier

BONUS_PRODUCT_PEAK = 1.25
BONUS_SEARCH_PEAK = 1.30
QUICK_LEAVE_PENALTY_DAYS = 30


def _quick_leave_penalty_mult(started_at, now) -> float:
    if not started_at:
        return 1.0
    days = (now.date() - started_at.date()).days
    if days >= QUICK_LEAVE_PENALTY_DAYS:
        return 1.0
    return 0.5 + 0.5 * (days / max(QUICK_LEAVE_PENALTY_DAYS - 1, 1))


def _linear_decay_bonus(now, started_at, until_at, peak: float) -> float:
    if not started_at or not until_at or now < started_at:
        return 1.0
    if now >= until_at:
        return 1.0
    span = (until_at - started_at).total_seconds()
    if span <= 0:
        return 1.0
    t = (now - started_at).total_seconds() / span
    return peak + (1.0 - peak) * t


def effective_multiplier_for_ste(
    mod: UserSteRelevanceModifier | None,
    day_penalty_mult: float | None,
    now,
) -> float:
    """Итоговый множитель к _score: penalty * bonus (бонусы: min из двух веток)."""
    penalty = 1.0
    shield = bool(mod and mod.shield_until and now < mod.shield_until)

    if not shield:
        if mod and mod.quick_leave_penalty_started_at:
            penalty = min(penalty, _quick_leave_penalty_mult(mod.quick_leave_penalty_started_at, now))
        if day_penalty_mult is not None:
            penalty = min(penalty, day_penalty_mult)

    bonus_candidates: list[float] = []
    if mod:
        if mod.bonus_product_started_at and mod.bonus_product_until:
            bp = _linear_decay_bonus(now, mod.bonus_product_started_at, mod.bonus_product_until, BONUS_PRODUCT_PEAK)
            if bp > 1.0 + 1e-9:
                bonus_candidates.append(bp)
        if mod.bonus_search_started_at and mod.bonus_search_until:
            bs = _linear_decay_bonus(now, mod.bonus_search_started_at, mod.bonus_search_until, BONUS_SEARCH_PEAK)
            if bs > 1.0 + 1e-9:
                bonus_candidates.append(bs)

    bonus = min(bonus_candidates) if bonus_candidates else 1.0
    return penalty * bonus


def get_relevance_multipliers(user_id: int, ste_ids: list[str], *, now=None) -> dict[str, float]:
    if not ste_ids:
        return {}
    now = now or timezone.now()
    uniq = list({s for s in ste_ids if s})
    if not uniq:
        return {}

    mods = {
        m.ste_id: m
        for m in UserSteRelevanceModifier.objects.filter(user_id=user_id, ste_id__in=uniq)
    }
    today = now.date()
    day_rows = {
        p.ste_id: p.mult
        for p in UserSteDayPenalty.objects.filter(user_id=user_id, ste_id__in=uniq, day=today)
    }

    out: dict[str, float] = {}
    for sid in uniq:
        mod = mods.get(sid)
        dmult = day_rows.get(sid)
        out[sid] = effective_multiplier_for_ste(mod, dmult, now)
    return out


def apply_multipliers_to_hits(hits: list[dict[str, Any]], user_id: int | None) -> None:
    if not user_id or not hits:
        return
    ids = [h.get("ste_id") for h in hits if h.get("ste_id")]
    mults = get_relevance_multipliers(user_id, ids)
    for h in hits:
        sid = h.get("ste_id")
        if not sid:
            continue
        m = mults.get(sid, 1.0)
        h["_score"] = float(h.get("_score", 0.0)) * m
        h["_personalization_mult"] = m
