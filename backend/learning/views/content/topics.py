from __future__ import annotations

from django.db.models import F
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...auth import apply_user_scope, get_request_user
from ...models import SavedTopic, SavedTopicContext

DEFAULT_TOPICS_PAGE_SIZE = 25
MAX_TOPICS_PAGE_SIZE = 100


def _safe_positive_int(raw_value, default: int, *, minimum: int = 1, maximum: int | None = None) -> int:
    try:
        parsed = int(str(raw_value))
    except (TypeError, ValueError):
        return default
    parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


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
        query = (request.query_params.get("q", "") or "").strip()
        page = _safe_positive_int(request.query_params.get("page"), 1)
        page_size = _safe_positive_int(request.query_params.get("page_size"), DEFAULT_TOPICS_PAGE_SIZE, maximum=MAX_TOPICS_PAGE_SIZE)
        offset = (page - 1) * page_size
        queryset = apply_user_scope(SavedTopic.objects, user).filter(
            source_language=source_language,
            target_language=target_language,
        )
        if query:
            queryset = queryset.filter(topic__icontains=query)
        rows = list(
            queryset.order_by("-last_used_at", "-id").values_list("topic", flat=True)[offset : offset + page_size + 1]
        )
        has_more = len(rows) > page_size
        topics = rows[:page_size]
        return Response({
            "topics": topics,
            "page": page,
            "page_size": page_size,
            "has_more": has_more,
            "next_page": page + 1 if has_more else None,
            "query": query,
        })


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
