from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class RegisterSerializer(serializers.Serializer):
    inn = serializers.CharField(max_length=32)
    password = serializers.CharField(min_length=1, write_only=True)
    orgName = serializers.CharField(max_length=512)
    location = serializers.CharField(max_length=512)


class InnTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Логин по полю inn (как на фронте); внутри — стандартный User.username = ИНН."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop("username", None)
        self.fields["inn"] = serializers.CharField(write_only=True)

    def validate(self, attrs):
        attrs["username"] = attrs.pop("inn").strip()
        return super().validate(attrs)


class AuthTokensResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()
    customerId = serializers.CharField()
    login = serializers.CharField()


class RefreshAccessResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()


class ErrorMessageSerializer(serializers.Serializer):
    message = serializers.CharField()


class CustomerRowSerializer(serializers.Serializer):
    customerInn = serializers.CharField()
    customerName = serializers.CharField()
    customerRegion = serializers.CharField()


class CustomerTableResponseSerializer(serializers.Serializer):
    items = CustomerRowSerializer(many=True)
    total = serializers.IntegerField()
    limit = serializers.IntegerField()
    offset = serializers.IntegerField()


class UpdateCustomerRegionSerializer(serializers.Serializer):
    location = serializers.CharField(max_length=512)