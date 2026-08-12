from __future__ import annotations

from django.utils import timezone

from ..auth import apply_user_scope
from ..models import Item
from ..review_schedule import local_day_bounds


def review_rows(
    *,
    user,
    now,
    source_language: str,
    target_language: str,
    excluded_item_ids: set[int],
    include_due_today: bool,
) -> list[tuple[object, int, str, Item]]:
    _, tomorrow = local_day_bounds(now)
    rows: list[tuple[object, int, str, Item]] = []
    for item_type in (Item.ItemType.PHRASE, Item.ItemType.WORD):
        for suffix, direction in (
            ("es_to_de", Item.ReviewDirection.SPANISH_TO_GERMAN),
            ("de_to_es", Item.ReviewDirection.GERMAN_TO_SPANISH),
        ):
            due_field = f"due_at_{suffix}"
            reviewed_field = f"last_reviewed_at_{suffix}"
            due_filter = {f"{due_field}__lt" if include_due_today else f"{due_field}__gte": tomorrow}
            queryset = apply_user_scope(Item.objects, user).filter(
                item_type=item_type,
                is_learned=False,
                source_language=source_language,
                target_language=target_language,
                **{f"{reviewed_field}__isnull": False},
                **due_filter,
            )
            if excluded_item_ids:
                queryset = queryset.exclude(id__in=excluded_item_ids)
            for item in queryset.order_by(due_field, "id"):
                rows.append((getattr(item, due_field), item.id, direction, item))
    rows.sort(key=lambda row: (row[0], row[1], row[2]))
    return rows
