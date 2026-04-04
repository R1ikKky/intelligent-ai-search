"""Схемы ответа поиска для OpenAPI."""

from rest_framework import serializers


class SteCardItemSerializer(serializers.Serializer):
    steId = serializers.CharField()
    name = serializers.CharField()
    category = serializers.CharField()
    attributes = serializers.CharField()
    score = serializers.FloatField()
    scoreNorm = serializers.FloatField()


class ManufacturerSerializer(serializers.Serializer):
    inn = serializers.CharField()
    name = serializers.CharField()


class SteCardSerializer(serializers.Serializer):
    manufacturer = ManufacturerSerializer(allow_null=True)
    confidence = serializers.FloatField()
    items = SteCardItemSerializer(many=True)


class ProductSearchItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    externalId = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    category = serializers.CharField()
    unit = serializers.CharField()
    score = serializers.FloatField()
    personalizedScore = serializers.FloatField()
    isPersonalized = serializers.BooleanField()


class ProductSearchResponseSerializer(serializers.Serializer):
    items = ProductSearchItemSerializer(many=True)
    cards = SteCardSerializer(many=True)
    total = serializers.IntegerField()
    page = serializers.IntegerField()
    limit = serializers.IntegerField()
    suggestion = serializers.CharField(allow_null=True)
