from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Customer
from .serializers import (
    CustomerRowSerializer,
    CustomerTableResponseSerializer,
    ErrorMessageSerializer,
    UpdateCustomerRegionSerializer,
)


def _customer_row(c: Customer) -> dict:
    return {
        "customerInn": c.customer_inn,
        "customerName": c.customer_name,
        "customerRegion": c.customer_region,
    }


def _parse_limit_offset(request) -> tuple[int, int]:
    try:
        limit = int(request.query_params.get("limit", "1000"))
    except ValueError:
        limit = 1000
    try:
        offset = int(request.query_params.get("offset", "0"))
    except ValueError:
        offset = 0
    limit = max(1, min(limit, 5000))
    offset = max(0, offset)
    return limit, offset


@extend_schema(
    tags=["customers"],
    summary="Список заказчиков (без авторизации)",
    description="Таблица `customer`: ИНН, название, регион. Пагинация query-параметрами `limit` и `offset`.",
    parameters=[
        OpenApiParameter(
            "limit",
            OpenApiTypes.INT,
            OpenApiParameter.QUERY,
            default=1000,
            description="Максимум строк за запрос (не больше 5000).",
        ),
        OpenApiParameter(
            "offset",
            OpenApiTypes.INT,
            OpenApiParameter.QUERY,
            default=0,
            description="Смещение от начала выборки.",
        ),
    ],
    responses={200: CustomerTableResponseSerializer},
)
class CustomerListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        limit, offset = _parse_limit_offset(request)
        total = Customer.objects.count()
        qs = Customer.objects.all().order_by("customer_inn")[offset : offset + limit]
        items = [_customer_row(c) for c in qs]
        return Response(
            {"items": items, "total": total, "limit": limit, "offset": offset},
            status=status.HTTP_200_OK,
        )


@extend_schema(
    tags=["customers"],
    summary="Сменить регион заказчика (JWT)",
    description=(
        "Обновляет `customer_region` для строки заказчика с ИНН, совпадающим с "
        "`sub`/username в access JWT (как после login/register)."
    ),
    request=UpdateCustomerRegionSerializer,
    responses={
        200: CustomerRowSerializer,
        401: ErrorMessageSerializer,
        404: ErrorMessageSerializer,
    },
    auth=[{"jwtAuth": []}],
)
@method_decorator(csrf_exempt, name="dispatch")
class CustomerMeRegionView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        inn = request.user.get_username()
        ser = UpdateCustomerRegionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        location = ser.validated_data["location"].strip()
        try:
            customer = Customer.objects.get(pk=inn)
        except Customer.DoesNotExist:
            return Response(
                {"message": "Customer not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        customer.customer_region = location
        customer.save(update_fields=["customer_region"])
        return Response(_customer_row(customer), status=status.HTTP_200_OK)
