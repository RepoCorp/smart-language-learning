from django.db.models import Q

from .review_schedule import local_day_bounds


def deferred_difficult_items_filter(now) -> Q:
    """Items failed today are deliberately held for tomorrow's practice session."""
    today_start, _ = local_day_bounds(now)
    return Q(is_difficult=True) & (
        Q(difficult_marked_at__isnull=True) | Q(difficult_marked_at__gte=today_start)
    )
