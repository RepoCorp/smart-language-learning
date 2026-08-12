from __future__ import annotations

from datetime import datetime, time, timedelta

from django.utils import timezone


def local_day_bounds(now):
    current_timezone = timezone.get_current_timezone()
    local_date = timezone.localdate(now, timezone=current_timezone)
    start_of_day = timezone.make_aware(datetime.combine(local_date, time.min), current_timezone)
    start_of_next_day = timezone.make_aware(
        datetime.combine(local_date + timedelta(days=1), time.min),
        current_timezone,
    )
    return start_of_day, start_of_next_day


def next_review_at(now, interval_days: int):
    current_timezone = timezone.get_current_timezone()
    local_date = timezone.localdate(now, timezone=current_timezone)
    target_date = local_date + timedelta(days=interval_days)
    return timezone.make_aware(datetime.combine(target_date, time.min), current_timezone)
