from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Item


class OverviewStatsView(APIView):
    def get(self, request: Request) -> Response:
        now = timezone.now()
        ready_to_review = count_ready_reviews(now)
        future_reviews = count_future_reviews(now)
        not_started = Item.objects.filter(
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).count()

        return Response(
            {
                "ready_to_review": ready_to_review,
                "future_reviews": future_reviews,
                "not_started": not_started,
            }
        )


def count_ready_reviews(now) -> int:
    return (
        Item.objects.filter(last_reviewed_at_es_to_de__isnull=False, due_at_es_to_de__lte=now).count()
        + Item.objects.filter(last_reviewed_at_de_to_es__isnull=False, due_at_de_to_es__lte=now).count()
    )


def count_future_reviews(now) -> int:
    return (
        Item.objects.filter(last_reviewed_at_es_to_de__isnull=False, due_at_es_to_de__gt=now).count()
        + Item.objects.filter(last_reviewed_at_de_to_es__isnull=False, due_at_de_to_es__gt=now).count()
    )
