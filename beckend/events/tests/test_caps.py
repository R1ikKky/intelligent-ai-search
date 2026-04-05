"""Лимиты бонусов/штрафов и вытеснение слабейших."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from events.caps import (
    MAX_ACTIVE_BONUS_STE,
    MAX_ACTIVE_PENALTY_STE,
    active_penalty_ste_ids,
    clear_bonus_and_shield,
    effective_bonus_multiplier,
    has_active_bonus,
    trim_excess_bonuses,
    trim_excess_penalties,
)
from events.ingest import BONUS_DURATION, process_event_after_save
from events.models import UserSteDayPenalty, UserSteRelevanceModifier, UserTelemetryEvent


def _bonus_mod(user, ste_id: str, *, peak_product: bool, t0=None):
    now = t0 or timezone.now()
    m = UserSteRelevanceModifier.objects.create(user=user, ste_id=ste_id)
    if peak_product:
        m.bonus_product_started_at = now
        m.bonus_product_until = now + BONUS_DURATION
    else:
        m.bonus_search_started_at = now
        m.bonus_search_until = now + BONUS_DURATION
    m.shield_until = now + BONUS_DURATION
    m.save()
    return m


class BonusCapTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("bcap", password="x")
        self.now = timezone.now()

    def test_trim_keeps_strongest_eight(self):
        base = self.now - timedelta(days=6)
        for i in range(MAX_ACTIVE_BONUS_STE + 1):
            sid = f"B{i}"
            t0 = base + timedelta(minutes=i)
            m = UserSteRelevanceModifier.objects.create(user=self.user, ste_id=sid)
            m.bonus_product_started_at = t0
            m.bonus_product_until = t0 + BONUS_DURATION
            m.shield_until = t0 + BONUS_DURATION
            m.save()

        trim_excess_bonuses(self.user, self.now)
        active = [m for m in UserSteRelevanceModifier.objects.filter(user=self.user) if has_active_bonus(m, self.now)]
        self.assertEqual(len(active), MAX_ACTIVE_BONUS_STE)
        strengths = sorted(effective_bonus_multiplier(m, self.now) for m in active)
        self.assertGreater(strengths[0], 1.0)

    def test_ninth_bonus_via_ingest_drops_weakest(self):
        base = timezone.now() - timedelta(hours=20)
        for i in range(MAX_ACTIVE_BONUS_STE):
            _bonus_mod(self.user, f"S{i}", peak_product=True, t0=base)

        now = timezone.now()
        ev = UserTelemetryEvent(
            user=self.user,
            session_id="s1",
            event_id="e-new",
            event_type="ste_product_long_engaged",
            ste_id="S_NEW",
            event_at=now,
            payload={},
        )
        process_event_after_save(ev)

        check_at = timezone.now()
        active_sids = {
            m.ste_id
            for m in UserSteRelevanceModifier.objects.filter(user=self.user)
            if has_active_bonus(m, check_at)
        }
        self.assertEqual(len(active_sids), MAX_ACTIVE_BONUS_STE)
        self.assertIn("S_NEW", active_sids)


class PenaltyCapTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("pcap", password="x")
        self.now = timezone.now()
        self.day = self.now.date()

    def test_trim_penalties_keeps_twenty_four_strongest(self):
        for i in range(MAX_ACTIVE_PENALTY_STE + 1):
            UserSteDayPenalty.objects.create(
                user=self.user,
                ste_id=f"P{i}",
                day=self.day,
                mult=0.75 + i * 0.001,
            )

        trim_excess_penalties(self.user, self.now)
        ids = active_penalty_ste_ids(self.user, self.now)
        self.assertEqual(len(ids), MAX_ACTIVE_PENALTY_STE)
        self.assertIn("P0", ids)
        self.assertNotIn("P24", ids)

    def test_quick_refine_batch_trims(self):
        seen = [f"Q{i}" for i in range(30)]
        ev = UserTelemetryEvent(
            user=self.user,
            session_id="s2",
            event_id="e-qr",
            event_type="search_quick_refine",
            ste_id=None,
            event_at=self.now,
            payload={"seenSteIds": seen},
        )
        process_event_after_save(ev)
        self.assertLessEqual(len(active_penalty_ste_ids(self.user, self.now)), MAX_ACTIVE_PENALTY_STE)


class ClearBonusTests(TestCase):
    def test_clear_bonus_zeroes_fields(self):
        user = User.objects.create_user("clr", password="x")
        now = timezone.now()
        m = UserSteRelevanceModifier.objects.create(
            user=user,
            ste_id="X",
            bonus_product_started_at=now,
            bonus_product_until=now + BONUS_DURATION,
            shield_until=now + BONUS_DURATION,
        )
        clear_bonus_and_shield(m)
        m.save()
        m.refresh_from_db()
        self.assertIsNone(m.bonus_product_started_at)
        self.assertIsNone(m.shield_until)
