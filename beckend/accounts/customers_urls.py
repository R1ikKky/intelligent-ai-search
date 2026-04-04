from django.urls import path

from .customer_views import CustomerListView, CustomerMeRegionView

urlpatterns = [
    path("", CustomerListView.as_view()),
    path("me/region", CustomerMeRegionView.as_view()),
]
