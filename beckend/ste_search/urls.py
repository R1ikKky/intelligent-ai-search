from django.urls import path

from ste_search.views import ProductSearchView

urlpatterns = [
    path("search", ProductSearchView.as_view()),
]
