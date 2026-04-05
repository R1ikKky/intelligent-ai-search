from django.contrib import admin

from events.models import UserSteDayPenalty, UserSteRelevanceModifier, UserTelemetryEvent


@admin.register(UserTelemetryEvent)
class UserTelemetryEventAdmin(admin.ModelAdmin):
    list_display = ("event_at", "user", "event_type", "ste_id", "session_id")
    list_filter = ("event_type",)
    search_fields = ("ste_id", "session_id", "event_id")


@admin.register(UserSteRelevanceModifier)
class UserSteRelevanceModifierAdmin(admin.ModelAdmin):
    list_display = ("user", "ste_id", "shield_until", "updated_at")
    search_fields = ("ste_id",)


@admin.register(UserSteDayPenalty)
class UserSteDayPenaltyAdmin(admin.ModelAdmin):
    list_display = ("user", "ste_id", "day", "mult")
