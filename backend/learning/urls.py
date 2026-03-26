from django.urls import path

from .views import (
    ContentConfirmView,
    ContentItemDetailView,
    ContentItemMarkLearnedView,
    ContentItemQuestionView,
    ContentItemsView,
    ContentPreviewView,
    ContentTopicContextsView,
    ContentTopicDeleteView,
    ContentWordQuickAddView,
    ContentTopicsView,
    ContentWordsView,
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
    path("content/items", ContentItemsView.as_view(), name="content-items"),
    path("content/words", ContentWordsView.as_view(), name="content-words"),
    path("content/words/add", ContentWordQuickAddView.as_view(), name="content-word-quick-add"),
    path("content/items/<int:item_id>", ContentItemDetailView.as_view(), name="content-item-detail"),
    path("content/items/<int:item_id>/mark-learned", ContentItemMarkLearnedView.as_view(), name="content-item-mark-learned"),
    path("content/items/<int:item_id>/question", ContentItemQuestionView.as_view(), name="content-item-question"),
    path("content/topics", ContentTopicsView.as_view(), name="content-topics"),
    path("content/topics/delete", ContentTopicDeleteView.as_view(), name="content-topic-delete"),
    path("content/topic-contexts", ContentTopicContextsView.as_view(), name="content-topic-contexts"),
]
