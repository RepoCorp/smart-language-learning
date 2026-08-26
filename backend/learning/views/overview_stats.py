from django.db.models import Q
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..item_states import filter_new_items
from ..models import Item
from ..review_schedule import local_day_bounds
from ..review_availability import deferred_difficult_items_filter


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
        saved_items_queryset = apply_user_scope(Item.objects, user).filter(
            source_language=source_language,
            target_language=target_language,
        )
        saved_word_items = saved_items_queryset.filter(item_type=Item.ItemType.WORD).count()
        saved_phrase_items = saved_items_queryset.filter(item_type=Item.ItemType.PHRASE).count()
        not_started = filter_new_items(apply_user_scope(Item.objects, user).filter(
            source_language=source_language,
            target_language=target_language,
        )).count()
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
                "saved_items": saved_word_items + saved_phrase_items,
                "saved_word_items": saved_word_items,
                "saved_phrase_items": saved_phrase_items,
                "not_started": not_started,
                "difficult_items": difficult_items,
            }
        )


def count_ready_reviews(now, *, user, source_language: str, target_language: str) -> int:
    _, tomorrow = local_day_bounds(now)
    deferred_difficult_items = deferred_difficult_items_filter(now)
    return (
        apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=False,
            due_at_es_to_de__lt=tomorrow,
        ).exclude(deferred_difficult_items).count()
        + apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_de_to_es__isnull=False,
            due_at_de_to_es__lt=tomorrow,
        ).exclude(deferred_difficult_items).count()
    )


def count_future_reviews(now, *, user, source_language: str, target_language: str) -> int:
    _, tomorrow = local_day_bounds(now)
    return (
        apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=False,
            due_at_es_to_de__gte=tomorrow,
        ).count()
        + apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_de_to_es__isnull=False,
            due_at_de_to_es__gte=tomorrow,
        ).count()
    )
