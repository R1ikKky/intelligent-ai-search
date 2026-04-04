from django.apps import AppConfig


class SteSearchConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ste_search"
    verbose_name = "Поиск СТЕ"

    def ready(self) -> None:
        import ste_search.documents  # noqa: F401 — регистрация в django_elasticsearch_dsl
