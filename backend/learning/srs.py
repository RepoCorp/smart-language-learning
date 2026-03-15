from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from .models import Item

SRS_INTERVALS = [1, 3, 7, 14, 30]


def apply_review_result(item: Item, correct: bool, direction: str | None = None) -> Item:
    now = timezone.now()

    if direction == Item.ReviewDirection.SPANISH_TO_GERMAN:
        return _apply_directional_review_result(item, correct, now, "es_to_de")
    if direction == Item.ReviewDirection.GERMAN_TO_SPANISH:
        return _apply_directional_review_result(item, correct, now, "de_to_es")
    raise ValueError("Reviews require a valid direction")


def mark_item_seen(item: Item) -> Item:
    now = timezone.now()
    item.interval_days_es_to_de = 1
    item.last_reviewed_at_es_to_de = now
    item.due_at_es_to_de = now + timedelta(days=item.interval_days_es_to_de)

    item.interval_days_de_to_es = 1
    item.last_reviewed_at_de_to_es = now
    item.due_at_de_to_es = now + timedelta(days=item.interval_days_de_to_es)
    item.save(
        update_fields=[
            "interval_days_es_to_de",
            "last_reviewed_at_es_to_de",
            "due_at_es_to_de",
            "interval_days_de_to_es",
            "last_reviewed_at_de_to_es",
            "due_at_de_to_es",
            "updated_at",
        ]
    )
    return item


def _apply_directional_review_result(item: Item, correct: bool, now, suffix: str) -> Item:
    repetition_count_field = f"repetition_count_{suffix}"
    interval_days_field = f"interval_days_{suffix}"
    last_reviewed_at_field = f"last_reviewed_at_{suffix}"
    due_at_field = f"due_at_{suffix}"

    repetition_count = getattr(item, repetition_count_field)
    if correct:
        repetition_count += 1
        idx = min(repetition_count - 1, len(SRS_INTERVALS) - 1)
        interval_days = SRS_INTERVALS[idx]
    else:
        repetition_count = 0
        interval_days = 1

    setattr(item, repetition_count_field, repetition_count)
    setattr(item, interval_days_field, interval_days)
    setattr(item, last_reviewed_at_field, now)
    setattr(item, due_at_field, now + timedelta(days=interval_days))
    item.save(
        update_fields=[
            repetition_count_field,
            interval_days_field,
            last_reviewed_at_field,
            due_at_field,
            "updated_at",
        ]
    )
    return item
