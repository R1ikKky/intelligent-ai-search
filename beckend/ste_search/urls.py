from django.urls import path

from ste_search.views import ProductSearchView, ProductSuggestView, SteProductDetailView

urlpatterns = [
    path("search", ProductSearchView.as_view()),
    path("suggest", ProductSuggestView.as_view()),
    path("ste/<str:ste_id>", SteProductDetailView.as_view()),
]
