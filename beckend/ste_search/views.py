"""Поиск СТЕ для поставщика (JWT)."""

from accounts.serializers import ErrorMessageSerializer
from drf_spectacular.utils import OpenApiParameter, extend_schema
from drf_spectacular.types import OpenApiTypes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ste_search.serializers import ProductSearchResponseSerializer
from ste_search.search_service import search_ste_cards


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
            data = search_ste_cards(q, limit=limit, page=page)
        except RuntimeError as e:
            return Response({"message": str(e)}, status=503)
        except Exception as e:
            return Response({"message": f"Search failed: {e!s}"}, status=503)

        return Response(data)
