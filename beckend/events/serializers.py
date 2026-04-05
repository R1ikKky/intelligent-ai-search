from rest_framework import serializers

from events.models import UserTelemetryEvent


class TelemetryEventInSerializer(serializers.Serializer):
    event_id = serializers.CharField(max_length=64)
    event_type = serializers.CharField(max_length=64)
    search_query_id = serializers.CharField(max_length=256, required=False, allow_blank=True, allow_null=True)
    ste_id = serializers.CharField(max_length=128, required=False, allow_blank=True, allow_null=True)
    event_at = serializers.DateTimeField()
    dwell_ms = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    active_time_ms = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    payload = serializers.JSONField(required=False, default=dict)


class TelemetryBulkInSerializer(serializers.Serializer):
    session_id = serializers.CharField(max_length=64)
    events = TelemetryEventInSerializer(many=True)

    def validate_events(self, value):
        if len(value) > 200:
            raise serializers.ValidationError("Не более 200 событий за запрос.")
        return value


class TelemetryBulkResponseSerializer(serializers.Serializer):
    accepted = serializers.IntegerField()
