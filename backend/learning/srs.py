from __future__ import annotations

import math
from datetime import timedelta

from django.utils import timezone

from .models import Item

MIN_INTERVAL_DAYS = 1
MAX_INTERVAL_DAYS = 180


def apply_review_result(item: Item, correct: bool, direction: str | None = None) -> Item:
    now = timezone.now()

    if direction == Item.ReviewDirection.SPANISH_TO_GERMAN:
        return _apply_directional_review_result(item, correct, now, "es_to_de")
    if direction == Item.ReviewDirection.GERMAN_TO_SPANISH:
        return _apply_directional_review_result(item, correct, now, "de_to_es")
    raise ValueError("Reviews require a valid direction")


def mark_item_seen(item: Item) -> Item:
    now = timezone.now()
    item.interval_days_es_to_de = MIN_INTERVAL_DAYS
    item.last_reviewed_at_es_to_de = now
    item.due_at_es_to_de = now + timedelta(days=item.interval_days_es_to_de)

    item.interval_days_de_to_es = MIN_INTERVAL_DAYS
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

    repetition_count = max(0, int(getattr(item, repetition_count_field) or 0))
    current_interval = max(MIN_INTERVAL_DAYS, int(getattr(item, interval_days_field) or MIN_INTERVAL_DAYS))
    scheduled_due = getattr(item, due_at_field)

    if correct:
        repetition_count += 1
        interval_days = _next_interval_on_success(
            streak=repetition_count,
            current_interval=current_interval,
            now=now,
            scheduled_due=scheduled_due,
        )
    else:
        repetition_count = int(repetition_count * 0.4)
        interval_days = _next_interval_on_failure(current_interval=current_interval)

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


def _days_delta(later, earlier) -> float:
    return max(0.0, (later - earlier).total_seconds() / 86400.0)


def _success_growth_factor(streak: int) -> float:
    if streak <= 1:
        return 1.0
    # Smoothly increases with streak; avoids abrupt jumps.
    return min(3.0, 1.45 + (math.log(streak + 1) * 0.7))


def _next_interval_on_success(*, streak: int, current_interval: int, now, scheduled_due) -> int:
    if streak <= 1:
        return MIN_INTERVAL_DAYS

    growth = _success_growth_factor(streak)
    stability_bonus = min(0.2, math.log(current_interval + 1) * 0.05)

    lateness_bonus = 0.0
    earliness_penalty = 0.0
    if scheduled_due is not None:
        if now >= scheduled_due:
            lateness_days = _days_delta(now, scheduled_due)
            lateness_bonus = min(0.35, lateness_days * 0.06)
        else:
            early_days = _days_delta(scheduled_due, now)
            earliness_penalty = min(0.25, early_days * 0.05)

    multiplier = max(1.05, growth + stability_bonus + lateness_bonus - earliness_penalty)
    proposed = int(round(current_interval * multiplier))
    interval_days = max(current_interval + 1, proposed)
    return min(MAX_INTERVAL_DAYS, max(MIN_INTERVAL_DAYS, interval_days))


def _next_interval_on_failure(*, current_interval: int) -> int:
    reduced = int(round(current_interval * 0.35))
    return max(MIN_INTERVAL_DAYS, min(MAX_INTERVAL_DAYS, reduced))
