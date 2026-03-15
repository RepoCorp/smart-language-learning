from django.urls import path

from .views import HealthView, MarkSeenView, SessionView, SubmitReviewView

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
    path("session", SessionView.as_view(), name="session"),
    path("review", SubmitReviewView.as_view(), name="review"),
    path("seen", MarkSeenView.as_view(), name="seen"),
]
