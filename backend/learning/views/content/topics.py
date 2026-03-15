from __future__ import annotations

from django.db.models import F
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...models import SavedTopic, SavedTopicContext


def save_topic(topic: str, context: str = "") -> None:
    normalized = " ".join(topic.split()).strip()
    if not normalized:
        return
    topic_obj, created = SavedTopic.objects.get_or_create(topic=normalized)
    if not created:
        SavedTopic.objects.filter(topic=normalized).update(
            used_count=F("used_count") + 1,
            last_used_at=timezone.now(),
        )

    normalized_context = " ".join(context.split()).strip()
    if not normalized_context:
        return

    _, context_created = SavedTopicContext.objects.get_or_create(
        topic=topic_obj,
        context=normalized_context,
    )
    if not context_created:
        SavedTopicContext.objects.filter(
            topic=topic_obj,
            context=normalized_context,
        ).update(
            used_count=F("used_count") + 1,
            last_used_at=timezone.now(),
        )


class ContentTopicsView(APIView):
    def get(self, request: Request) -> Response:
        topics = list(
            SavedTopic.objects.order_by("-last_used_at")
            .values_list("topic", flat=True)[:20]
        )
        return Response({"topics": topics})


class ContentTopicContextsView(APIView):
    def get(self, request: Request) -> Response:
        topic = " ".join((request.query_params.get("topic", "") or "").split()).strip()
        if not topic:
            return Response({"contexts": []})

        contexts = list(
            SavedTopicContext.objects.filter(topic__topic=topic)
            .order_by("-last_used_at")
            .values_list("context", flat=True)[:20]
        )
        return Response({"contexts": contexts})
