"""Правила комбинирования штрафов/бонусов и щита."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from events.models import UserSteDayPenalty, UserSteRelevanceModifier
from events.relevance import effective_multiplier_for_ste, get_relevance_multipliers


class RelevanceRulesTests(TestCase):
    def test_min_penalty_quick_leave_and_day(self):
        user = User.objects.create_user("u1", password="x")
        now = timezone.now()
        mod = UserSteRelevanceModifier.objects.create(
            user=user,
            ste_id="S1",
            quick_leave_penalty_started_at=now,
        )
        UserSteDayPenalty.objects.create(user=user, ste_id="S1", day=now.date(), mult=0.75)
        m = effective_multiplier_for_ste(mod, 0.75, now)
        self.assertAlmostEqual(m, 0.5, places=3)

    def test_shield_blocks_penalties(self):
        user = User.objects.create_user("u2", password="x")
        now = timezone.now()
        mod = UserSteRelevanceModifier.objects.create(
            user=user,
            ste_id="S2",
            quick_leave_penalty_started_at=now - timedelta(days=1),
            shield_until=now + timedelta(days=1),
        )
        UserSteDayPenalty.objects.create(user=user, ste_id="S2", day=now.date(), mult=0.75)
        m = effective_multiplier_for_ste(mod, 0.75, now)
        self.assertAlmostEqual(m, 1.0, places=3)

    def test_bonus_between_one_and_peak(self):
        user = User.objects.create_user("u3", password="x")
        now = timezone.now()
        mod = UserSteRelevanceModifier.objects.create(
            user=user,
            ste_id="S3",
            bonus_product_started_at=now - timedelta(days=1),
            bonus_product_until=now + timedelta(days=6),
            bonus_search_started_at=now - timedelta(hours=12),
            bonus_search_until=now + timedelta(days=6),
        )
        m = effective_multiplier_for_ste(mod, None, now)
        self.assertGreater(m, 1.0)
        self.assertLess(m, 1.31)

    def test_get_relevance_multipliers_batch(self):
        user = User.objects.create_user("u4", password="x")
        now = timezone.now()
        UserSteRelevanceModifier.objects.create(
            user=user,
            ste_id="A",
            quick_leave_penalty_started_at=now,
        )
        out = get_relevance_multipliers(user.id, ["A", "B"], now=now)
        self.assertIn("A", out)
        self.assertIn("B", out)
        self.assertAlmostEqual(out["B"], 1.0, places=5)
