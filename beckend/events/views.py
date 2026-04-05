"""Приём батча телеметрии."""

from __future__ import annotations

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.serializers import ErrorMessageSerializer
from events.ingest import process_batch_events
from events.models import UserTelemetryEvent
from events.serializers import TelemetryBulkInSerializer, TelemetryBulkResponseSerializer


@extend_schema(
    tags=["events"],
    summary="Батч событий телеметрии",
    description="Сохранение событий для персонализации поиска (штрафы/бонусы по СТЕ).",
    request=TelemetryBulkInSerializer,
    responses={200: TelemetryBulkResponseSerializer, 400: ErrorMessageSerializer},
    auth=[{"jwtAuth": []}],
)
class EventsBulkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = TelemetryBulkInSerializer(data=request.data)
        if not ser.is_valid():
            return Response({"message": ser.errors}, status=400)

        session_id = ser.validated_data["session_id"]
        user = request.user
        rows: list[UserTelemetryEvent] = []
        existing_ids = set(
            UserTelemetryEvent.objects.filter(
                event_id__in=[e["event_id"] for e in ser.validated_data["events"]]
            ).values_list("event_id", flat=True)
        )

        for ev in ser.validated_data["events"]:
            eid = ev["event_id"]
            if eid in existing_ids:
                continue
            rows.append(
                UserTelemetryEvent(
                    user=user,
                    session_id=session_id,
                    event_id=eid,
                    event_type=ev["event_type"],
                    ste_id=(ev.get("ste_id") or "").strip() or None,
                    search_query_id=(ev.get("search_query_id") or "").strip() or None,
                    event_at=ev["event_at"],
                    dwell_ms=ev.get("dwell_ms"),
                    active_time_ms=ev.get("active_time_ms"),
                    payload=ev.get("payload") or {},
                )
            )

        if not rows:
            return Response({"accepted": 0})

        with transaction.atomic():
            UserTelemetryEvent.objects.bulk_create(rows)
            process_batch_events(rows)

        return Response({"accepted": len(rows)})
