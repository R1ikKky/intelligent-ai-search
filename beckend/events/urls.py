from django.urls import path

from events.views import EventsBulkView

urlpatterns = [
    path("bulk", EventsBulkView.as_view()),
]
