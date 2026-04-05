"""Обновление UserSteRelevanceModifier / UserSteDayPenalty по типу события."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from events.caps import trim_excess_bonuses, trim_excess_penalties
from events.models import UserSteDayPenalty, UserSteRelevanceModifier, UserTelemetryEvent

logger = logging.getLogger(__name__)

BONUS_DURATION = timedelta(days=7)
QUICK_LEAVE_MS = 15_000


def _get_mod(user: User, ste_id: str) -> UserSteRelevanceModifier:
    obj, _ = UserSteRelevanceModifier.objects.get_or_create(user=user, ste_id=ste_id)
    return obj


def process_event_after_save(event: UserTelemetryEvent) -> None:
    """Вызывается после сохранения одного события (в той же транзакции что bulk)."""
    user = event.user
    et = event.event_type
    ste_id = event.ste_id or (event.payload or {}).get("steId")
    now = timezone.now()

    try:
        if et == "ste_page_leave" and ste_id:
            dwell = event.dwell_ms
            if dwell is None and event.payload:
                dwell = event.payload.get("dwellMs")
            if dwell is not None and int(dwell) < QUICK_LEAVE_MS:
                mod = _get_mod(user, ste_id)
                mod.quick_leave_penalty_started_at = now
                mod.save(update_fields=["quick_leave_penalty_started_at", "updated_at"])
                trim_excess_penalties(user, now)

        elif et == "ste_product_long_engaged" and ste_id:
            mod = _get_mod(user, ste_id)
            mod.bonus_product_started_at = now
            mod.bonus_product_until = now + BONUS_DURATION
            new_shield = now + BONUS_DURATION
            mod.shield_until = max(mod.shield_until or new_shield, new_shield)
            mod.save(
                update_fields=[
                    "bonus_product_started_at",
                    "bonus_product_until",
                    "shield_until",
                    "updated_at",
                ]
            )
            trim_excess_bonuses(user, now)

        elif et == "search_card_deep_interest" and ste_id:
            mod = _get_mod(user, ste_id)
            mod.bonus_search_started_at = now
            mod.bonus_search_until = now + BONUS_DURATION
            new_shield = now + BONUS_DURATION
            mod.shield_until = max(mod.shield_until or new_shield, new_shield)
            mod.save(
                update_fields=[
                    "bonus_search_started_at",
                    "bonus_search_until",
                    "shield_until",
                    "updated_at",
                ]
            )
            trim_excess_bonuses(user, now)

        elif et == "search_quick_refine":
            payload = event.payload or {}
            seen = payload.get("seenSteIds") or payload.get("seen_ste_ids") or []
            if not isinstance(seen, list):
                return
            day = now.date()
            for sid in seen:
                if not sid or not isinstance(sid, str):
                    continue
                UserSteDayPenalty.objects.update_or_create(
                    user=user,
                    ste_id=str(sid)[:128],
                    day=day,
                    defaults={"mult": 0.75},
                )
            trim_excess_penalties(user, now)

        elif et in ("ste_page_enter", "search_submit", "suggestion_selected", "product_card_click"):
            pass
        else:
            logger.info("telemetry event type without ingest rule: %s", et)

    except Exception as e:
        logger.warning("ingest event %s failed: %s", et, e)


def process_batch_events(events: list[UserTelemetryEvent]) -> None:
    for e in events:
        process_event_after_save(e)
