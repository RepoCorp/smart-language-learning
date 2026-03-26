from __future__ import annotations

from django.db.models import F
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...auth import apply_user_scope, get_request_user
from ...models import SavedTopic, SavedTopicContext


def save_topic(
    *,
    user,
    topic: str,
    context: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> None:
    normalized = " ".join(topic.split()).strip()
    if not normalized:
        return
    topic_obj, created = apply_user_scope(SavedTopic.objects, user).get_or_create(
        topic=normalized,
        source_language=source_language,
        target_language=target_language,
        defaults={"user": user},
    )
    if not created:
        apply_user_scope(SavedTopic.objects, user).filter(
            topic=normalized,
            source_language=source_language,
            target_language=target_language,
        ).update(
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
        user = get_request_user(request)
        source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
        target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
        topics = list(
            apply_user_scope(SavedTopic.objects, user).filter(
                source_language=source_language,
                target_language=target_language,
            )
            .order_by("-last_used_at")
            .values_list("topic", flat=True)[:20]
        )
        return Response({"topics": topics})


class ContentTopicContextsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        topic = " ".join((request.query_params.get("topic", "") or "").split()).strip()
        source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
        target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
        if not topic:
            return Response({"contexts": []})

        contexts = list(
            apply_user_scope(SavedTopicContext.objects, user, field="topic__user")
            .filter(
                topic__topic=topic,
                topic__source_language=source_language,
                topic__target_language=target_language,
            )
            .order_by("-last_used_at")
            .values_list("context", flat=True)[:20]
        )
        return Response({"contexts": contexts})
