from django.urls import path

from .views import (
    ContentConfirmView,
    ContentPreviewView,
    HealthView,
    MarkSeenView,
    OverviewStatsView,
    SessionView,
    SubmitReviewView,
)

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
    path("overview-stats", OverviewStatsView.as_view(), name="overview-stats"),
    path("session", SessionView.as_view(), name="session"),
    path("review", SubmitReviewView.as_view(), name="review"),
    path("seen", MarkSeenView.as_view(), name="seen"),
    path("content/preview", ContentPreviewView.as_view(), name="content-preview"),
    path("content/confirm", ContentConfirmView.as_view(), name="content-confirm"),
]
