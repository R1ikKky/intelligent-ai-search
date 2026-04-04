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
