"""Поиск СТЕ для поставщика (JWT)."""

import logging

from accounts.serializers import ErrorMessageSerializer
from drf_spectacular.utils import OpenApiParameter, extend_schema
from drf_spectacular.types import OpenApiTypes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ste_search.query_history import record_search_query
from ste_search.serializers import (
    ProductSearchResponseSerializer,
    ProductSuggestResponseSerializer,
    SteProductDetailSerializer,
)
from ste_search.search_service import get_ste_by_id, search_ste_cards
from ste_search.suggest_service import fetch_ste_suggestions

logger = logging.getLogger(__name__)


@extend_schema(
    tags=["products"],
    summary="Поиск СТЕ (семантика + BM25)",
    description=(
        "Гибрид Elasticsearch: kNN по эмбеддингам и multi_match по тексту. "
        "Только СТЕ из `ste_data`, чей `ste_id` встречается в `history_contract.v_ste`. "
        "Выдача группируется в карточки по производителю и смысловой близости позиций."
    ),
    parameters=[
        OpenApiParameter("q", OpenApiTypes.STR, OpenApiParameter.QUERY, required=True, description="Текст запроса"),
        OpenApiParameter(
            "limit",
            OpenApiTypes.INT,
            OpenApiParameter.QUERY,
            default=20,
            description="Максимум карточек на страницу (1–100).",
        ),
        OpenApiParameter("page", OpenApiTypes.INT, OpenApiParameter.QUERY, default=1),
    ],
    responses={200: ProductSearchResponseSerializer, 503: ErrorMessageSerializer},
    auth=[{"jwtAuth": []}],
)
class ProductSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        try:
            limit = int(request.query_params.get("limit", "20"))
        except ValueError:
            limit = 20
        try:
            page = int(request.query_params.get("page", "1"))
        except ValueError:
            page = 1

        try:
            data = search_ste_cards(q, limit=limit, page=page, user_id=request.user.pk)
        except RuntimeError as e:
            logger.warning("search_ste_cards RuntimeError: %s", e)
            return Response({"message": str(e)}, status=503)
        except Exception as e:
            logger.exception("search_ste_cards failed")
            return Response({"message": f"Search failed: {e!s}"}, status=503)

        if q:
            try:
                record_search_query(request.user, q)
            except Exception:
                pass

        return Response(data)


@extend_schema(
    tags=["products"],
    summary="Подсказки поиска (опечатки, каталог, история)",
    description=(
        "Phrase suggest и лёгкий поиск по индексу `ste_search` без kNN; "
        "плюс недавние запросы пользователя из Postgres."
    ),
    parameters=[
        OpenApiParameter("q", OpenApiTypes.STR, OpenApiParameter.QUERY, required=True, description="Префикс или фраза"),
        OpenApiParameter(
            "limit",
            OpenApiTypes.INT,
            OpenApiParameter.QUERY,
            default=10,
            description="Максимум подсказок (3–20).",
        ),
    ],
    responses={200: ProductSuggestResponseSerializer, 503: ErrorMessageSerializer},
    auth=[{"jwtAuth": []}],
)
class ProductSuggestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"suggestions": []})

        try:
            lim = int(request.query_params.get("limit", "10"))
        except ValueError:
            lim = 10

        try:
            suggestions = fetch_ste_suggestions(request.user, q, limit=lim)
        except Exception as e:
            return Response({"message": f"Suggest failed: {e!s}"}, status=503)

        return Response({"suggestions": suggestions})


@extend_schema(
    tags=["products"],
    summary="Карточка СТЕ по идентификатору",
    description="Данные из индекса `ste_search` (Elasticsearch).",
    responses={200: SteProductDetailSerializer, 404: ErrorMessageSerializer},
    auth=[{"jwtAuth": []}],
)
class SteProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ste_id: str):
        data = get_ste_by_id(ste_id)
        if not data:
            return Response({"message": "СТЕ не найдено"}, status=404)
        return Response(data)
