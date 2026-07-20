from django.db.models import Q
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..models import Item


class OverviewStatsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
        target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
        now = timezone.now()
        ready_to_review = count_ready_reviews(now, user=user, source_language=source_language, target_language=target_language)
        future_reviews = count_future_reviews(now, user=user, source_language=source_language, target_language=target_language)
        word_items = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).filter(
            Q(last_reviewed_at_es_to_de__isnull=False) | Q(last_reviewed_at_de_to_es__isnull=False),
        ).count()
        not_started = apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).count()
        difficult_items = apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            is_difficult=True,
            source_language=source_language,
            target_language=target_language,
        ).count()

        return Response(
            {
                "ready_to_review": ready_to_review,
                "future_reviews": future_reviews,
                "word_items": word_items,
                "not_started": not_started,
                "difficult_items": difficult_items,
            }
        )


def count_ready_reviews(now, *, user, source_language: str, target_language: str) -> int:
    return (
        apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=False,
            due_at_es_to_de__lte=now,
        ).count()
        + apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_de_to_es__isnull=False,
            due_at_de_to_es__lte=now,
        ).count()
    )


def count_future_reviews(now, *, user, source_language: str, target_language: str) -> int:
    return (
        apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=False,
            due_at_es_to_de__gt=now,
        ).count()
        + apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_de_to_es__isnull=False,
            due_at_de_to_es__gt=now,
        ).count()
    )
