# Generated manually for SearchQueryHistory

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("ste_search", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SearchQueryHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("query_text", models.TextField()),
                ("normalized_query", models.CharField(db_index=True, max_length=2048)),
                ("last_used_at", models.DateTimeField(auto_now=True)),
                ("use_count", models.PositiveIntegerField(default=1)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="search_query_history",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-last_used_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="searchqueryhistory",
            constraint=models.UniqueConstraint(
                fields=("user", "normalized_query"),
                name="ste_search_history_user_norm_q",
            ),
        ),
        migrations.AddIndex(
            model_name="searchqueryhistory",
            index=models.Index(fields=["user", "-last_used_at"], name="ste_hist_user_last_idx"),
        ),
    ]
