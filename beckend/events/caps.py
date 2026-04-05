"""Лимиты числа СТЕ с активными бонусами/штрафами и вытеснение самых слабых эффектов."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.utils import timezone

from events.models import UserSteDayPenalty, UserSteRelevanceModifier
from events.relevance import (
    BONUS_PRODUCT_PEAK,
    BONUS_SEARCH_PEAK,
    _linear_decay_bonus,
    _quick_leave_penalty_mult,
)

MAX_ACTIVE_BONUS_STE = 8
MAX_ACTIVE_PENALTY_STE = 24
_EPS = 1e-5


def effective_bonus_multiplier(mod: UserSteRelevanceModifier, now) -> float:
    """Множитель бонуса: min среди активных веток; 1.0 если нет действующих окон."""
    parts: list[float] = []
    if mod.bonus_product_started_at and mod.bonus_product_until:
        bp = _linear_decay_bonus(
            now,
            mod.bonus_product_started_at,
            mod.bonus_product_until,
            BONUS_PRODUCT_PEAK,
        )
        if bp > 1.0 + _EPS:
            parts.append(bp)
    if mod.bonus_search_started_at and mod.bonus_search_until:
        bs = _linear_decay_bonus(
            now,
            mod.bonus_search_started_at,
            mod.bonus_search_until,
            BONUS_SEARCH_PEAK,
        )
        if bs > 1.0 + _EPS:
            parts.append(bs)
    return min(parts) if parts else 1.0


def has_active_bonus(mod: UserSteRelevanceModifier, now) -> bool:
    return effective_bonus_multiplier(mod, now) > 1.0 + _EPS


def clear_bonus_and_shield(mod: UserSteRelevanceModifier) -> None:
    mod.bonus_product_started_at = None
    mod.bonus_product_until = None
    mod.bonus_search_started_at = None
    mod.bonus_search_until = None
    mod.shield_until = None


def trim_excess_bonuses(user: User, now=None) -> None:
    """
    Не более MAX_ACTIVE_BONUS_STE товаров с бонусом.
    Самый слабый бонус — минимальный множитель (>1 сильнее, ближе к 1 слабее).
    """
    now = now or timezone.now()
    while True:
        mods = list(UserSteRelevanceModifier.objects.filter(user=user))
        active = [m for m in mods if has_active_bonus(m, now)]
        if len(active) <= MAX_ACTIVE_BONUS_STE:
            return
        weakest = min(active, key=lambda m: effective_bonus_multiplier(m, now))
        clear_bonus_and_shield(weakest)
        weakest.save(
            update_fields=[
                "bonus_product_started_at",
                "bonus_product_until",
                "bonus_search_started_at",
                "bonus_search_until",
                "shield_until",
                "updated_at",
            ]
        )


def effective_penalty_multiplier(user: User, ste_id: str, now) -> float:
    """
    Итоговый штраф как множитель в (0, 1]; 1.0 — нет штрафа.
    min(месячный quick-leave, дневной), как в поиске под щитом.
    """
    pen = 1.0
    mod = UserSteRelevanceModifier.objects.filter(user=user, ste_id=ste_id).first()
    if mod and mod.quick_leave_penalty_started_at:
        q = _quick_leave_penalty_mult(mod.quick_leave_penalty_started_at, now)
        pen = min(pen, q)
    day = now.date()
    dp = UserSteDayPenalty.objects.filter(user=user, ste_id=ste_id, day=day).first()
    if dp is not None:
        pen = min(pen, float(dp.mult))
    return pen


def active_penalty_ste_ids(user: User, now) -> set[str]:
    """Уникальные ste_id с заметным штрафом сейчас (quick-leave или дневной)."""
    ids: set[str] = set()
    day = now.date()
    for m in UserSteRelevanceModifier.objects.filter(user=user).only(
        "ste_id", "quick_leave_penalty_started_at"
    ):
        if not m.quick_leave_penalty_started_at:
            continue
        q = _quick_leave_penalty_mult(m.quick_leave_penalty_started_at, now)
        if q < 1.0 - _EPS:
            ids.add(m.ste_id)
    for p in UserSteDayPenalty.objects.filter(user=user, day=day).only("ste_id", "mult"):
        if float(p.mult) < 1.0 - _EPS:
            ids.add(p.ste_id)
    return ids


def clear_penalties_for_ste(user: User, ste_id: str, now) -> None:
    UserSteRelevanceModifier.objects.filter(user=user, ste_id=ste_id).update(
        quick_leave_penalty_started_at=None
    )
    UserSteDayPenalty.objects.filter(user=user, ste_id=ste_id, day=now.date()).delete()


def trim_excess_penalties(user: User, now=None) -> None:
    """
    Не более MAX_ACTIVE_PENALTY_STE товаров со штрафом.
    Самый слабый штраф — множитель ближе к 1.0 (выше значение pen_mult).
    """
    now = now or timezone.now()
    while True:
        ids = active_penalty_ste_ids(user, now)
        if len(ids) <= MAX_ACTIVE_PENALTY_STE:
            return
        weakest_sid = max(ids, key=lambda sid: effective_penalty_multiplier(user, sid, now))
        clear_penalties_for_ste(user, weakest_sid, now)
