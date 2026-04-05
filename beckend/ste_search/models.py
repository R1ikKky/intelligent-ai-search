from django.conf import settings
from django.db import models


class SteSearchSource(models.Model):
    """Привязка документа ES к таблице `ste_data` (только схема; индексация — команда rebuild_ste_index)."""

    ste_id = models.TextField(primary_key=True)
    ste_name = models.TextField()
    ste_category = models.TextField()
    ste_attributes = models.TextField()

    class Meta:
        managed = False
        db_table = "ste_data"


class SearchQueryHistory(models.Model):
    """История поисковых запросов пользователя (для подсказок)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="search_query_history",
    )
    query_text = models.TextField()
    normalized_query = models.CharField(max_length=2048, db_index=True)
    last_used_at = models.DateTimeField(auto_now=True)
    use_count = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "normalized_query"],
                name="ste_search_history_user_norm_q",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-last_used_at"], name="ste_hist_user_last_idx"),
        ]
        ordering = ["-last_used_at"]

    def __str__(self) -> str:
        return f"{self.user_id}: {self.normalized_query[:40]!r}"
