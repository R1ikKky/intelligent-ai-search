from django.contrib.auth.models import User
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Customer
from .serializers import (
    AuthTokensResponseSerializer,
    ErrorMessageSerializer,
    InnTokenObtainPairSerializer,
    RefreshAccessResponseSerializer,
    RegisterSerializer,
)


def _refresh_max_age() -> int:
    return int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())


def _set_refresh(response: Response, refresh: str) -> None:
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh,
        max_age=_refresh_max_age(),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path="/",
    )


def _clear_refresh(response: Response) -> None:
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path="/")


def _signing_configured() -> bool:
    key = settings.SIMPLE_JWT.get("SIGNING_KEY")
    return bool(key)


@extend_schema(
    tags=["auth"],
    summary="Регистрация",
    request=RegisterSerializer,
    responses={
        201: AuthTokensResponseSerializer,
        409: ErrorMessageSerializer,
        500: ErrorMessageSerializer,
    },
)
@method_decorator(csrf_exempt, name="dispatch")
class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        if not _signing_configured():
            return Response(
                {"message": "JWT signing key is not configured (JWT_ACCESS_SECRET or DJANGO_SECRET_KEY)"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        inn = ser.validated_data["inn"].strip()
        password = ser.validated_data["password"]
        org_name = ser.validated_data["orgName"].strip()
        location = ser.validated_data["location"].strip()

        if User.objects.filter(username=inn).exists():
            return Response(
                {"message": "User with this INN already registered"},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            try:
                customer = Customer.objects.get(pk=inn)
            except Customer.DoesNotExist:
                customer = None

            if customer:
                customer.customer_name = org_name
                if location != customer.customer_region:
                    customer.customer_region = location
                customer.save(update_fields=["customer_name", "customer_region"])
            else:
                Customer.objects.create(
                    customer_inn=inn,
                    customer_name=org_name,
                    customer_region=location,
                )

            user = User.objects.create_user(username=inn, password=password)

        refresh = RefreshToken.for_user(user)
        refresh_s = str(refresh)
        resp = Response(
            {"accessToken": str(refresh.access_token), "customerId": inn, "login": inn},
            status=status.HTTP_201_CREATED,
        )
        _set_refresh(resp, refresh_s)
        return resp


@extend_schema(
    tags=["auth"],
    summary="Вход",
    request=InnTokenObtainPairSerializer,
    responses={
        200: AuthTokensResponseSerializer,
        401: ErrorMessageSerializer,
        500: ErrorMessageSerializer,
    },
)
@method_decorator(csrf_exempt, name="dispatch")
class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        if not _signing_configured():
            return Response(
                {"message": "JWT signing key is not configured"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        ser = InnTokenObtainPairSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"message": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        inn = ser.user.get_username()
        resp = Response(
            {
                "accessToken": ser.validated_data["access"],
                "customerId": inn,
                "login": inn,
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh(resp, ser.validated_data["refresh"])
        return resp


@extend_schema(
    tags=["auth"],
    summary="Обновить access JWT",
    description=(
        "Refresh передаётся в httpOnly-cookie `refreshToken` (ставится при login/register). "
        "В Swagger UI после «Try it out» cookie обычно не сохраняется между запросами — "
        "удобнее проверять через браузер или curl с `-b`/`-c`."
    ),
    request=None,
    responses={
        200: RefreshAccessResponseSerializer,
        401: ErrorMessageSerializer,
        500: ErrorMessageSerializer,
    },
)
@method_decorator(csrf_exempt, name="dispatch")
class RefreshView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        if not _signing_configured():
            return Response(
                {"message": "JWT signing key is not configured"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw:
            return Response(
                {"message": "Missing refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        ser = TokenRefreshSerializer(data={"refresh": raw})
        if not ser.is_valid():
            return Response(
                {"message": "Invalid refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(
            {"accessToken": ser.validated_data["access"]},
            status=status.HTTP_200_OK,
        )


@extend_schema(
    tags=["auth"],
    summary="Выход",
    request=None,
    responses={204: OpenApiResponse(description="Cookie refreshToken удалена")},
)
@method_decorator(csrf_exempt, name="dispatch")
class LogoutView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        resp = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh(resp)
        return resp


