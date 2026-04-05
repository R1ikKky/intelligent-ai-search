from django.conf import settings
from django.db import models


class UserTelemetryEvent(models.Model):
    """Сырой лог событий с клиента."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="telemetry_events",
    )
    session_id = models.CharField(max_length=64, db_index=True)
    event_id = models.CharField(max_length=64, unique=True)
    event_type = models.CharField(max_length=64, db_index=True)
    ste_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    search_query_id = models.CharField(max_length=256, blank=True, null=True)
    event_at = models.DateTimeField(db_index=True)
    dwell_ms = models.PositiveIntegerField(null=True, blank=True)
    active_time_ms = models.PositiveIntegerField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-event_at"]
        indexes = [
            models.Index(fields=["user", "-event_at"]),
            models.Index(fields=["user", "ste_id"]),
        ]


class UserSteRelevanceModifier(models.Model):
    """Материализованные штрафы/бонусы по паре пользователь–СТЕ."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ste_relevance_modifiers",
    )
    ste_id = models.CharField(max_length=128, db_index=True)
    quick_leave_penalty_started_at = models.DateTimeField(null=True, blank=True)
    bonus_product_started_at = models.DateTimeField(null=True, blank=True)
    bonus_product_until = models.DateTimeField(null=True, blank=True)
    bonus_search_started_at = models.DateTimeField(null=True, blank=True)
    bonus_search_until = models.DateTimeField(null=True, blank=True)
    shield_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "ste_id"], name="events_user_ste_rel_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "ste_id"]),
        ]


class UserSteDayPenalty(models.Model):
    """Дневной штраф после быстрого уточнения запроса (×0.75 до конца календарного дня)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ste_day_penalties",
    )
    ste_id = models.CharField(max_length=128, db_index=True)
    day = models.DateField(db_index=True)
    mult = models.FloatField(default=0.75)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "ste_id", "day"], name="events_user_ste_day_pen_unique"),
        ]
