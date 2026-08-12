from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .auth import apply_user_scope
from .models import DailyLearningProgress, Item, LearningStreakPause, LearningStreakProfile
from .review_schedule import local_day_bounds

ACTIVE_STUDY_SECONDS_REQUIRED = 30 * 60
DAILY_POOL_ITEMS_REQUIRED = 5
FLEX_DAYS_MAXIMUM = 3
QUALIFYING_DAYS_PER_FLEX_DAY = 7
PAUSE_MAXIMUM_DAYS = 7
PAUSE_COOLDOWN_DAYS = 90
PAUSE_RETROACTIVE_DAYS = 7


def record_study_time(user, seconds: int, *, source_language: str, target_language: str) -> dict:
    if user is None:
        return {}
    with transaction.atomic():
        progress = _today_progress(user)
        recorded_seconds = min(max(int(seconds), 0), 300)
        language_key = _language_key(source_language, target_language)
        seconds_by_language = dict(progress.active_seconds_by_language)
        seconds_by_language[language_key] = int(seconds_by_language.get(language_key, 0)) + recorded_seconds
        progress.active_seconds_by_language = seconds_by_language
        progress.active_seconds += recorded_seconds
        progress.save(update_fields=["active_seconds", "active_seconds_by_language", "updated_at"])
        return progress_payload(user, source_language=source_language, target_language=target_language)


def record_completed_item(user, item: Item, direction: str | None) -> dict:
    if user is None:
        return {}
    with transaction.atomic():
        progress = _today_progress(user)
        language_key = _language_key(item.source_language, item.target_language)
        entry_key = f"{language_key}:{item.id}:{direction or 'new'}"
        keys = set(str(value) for value in progress.completed_entry_keys)
        if entry_key not in keys:
            keys.add(entry_key)
            progress.completed_entry_keys = sorted(keys)
            completed_for_language = _completed_entry_count(progress, language_key)
            if completed_for_language >= DAILY_POOL_ITEMS_REQUIRED and _due_review_count(
                user,
                source_language=item.source_language,
                target_language=item.target_language,
            ) == 0:
                progress.completed_daily_pool = True
            progress.save(update_fields=["completed_entry_keys", "completed_daily_pool", "updated_at"])
        return progress_payload(user, source_language=item.source_language, target_language=item.target_language)


def create_pause(user, *, start_date, end_date, source_language: str = "spanish", target_language: str = "german") -> dict:
    today = timezone.localdate()
    if start_date > today or end_date < start_date or end_date > today + timedelta(days=PAUSE_MAXIMUM_DAYS - 1):
        raise ValueError("Choose a pause between today and the next seven days")
    if start_date < today - timedelta(days=PAUSE_RETROACTIVE_DAYS - 1):
        raise ValueError("A pause can only restore the previous seven days")
    if (end_date - start_date).days + 1 > PAUSE_MAXIMUM_DAYS:
        raise ValueError("A pause can last at most seven days")
    if LearningStreakPause.objects.filter(user=user, end_date__gt=today - timedelta(days=PAUSE_COOLDOWN_DAYS)).exists():
        raise ValueError("A streak pause is available again 90 days after the previous pause")
    if LearningStreakPause.objects.filter(user=user, start_date__lte=end_date, end_date__gte=start_date).exists():
        raise ValueError("This pause overlaps an existing pause")
    LearningStreakPause.objects.create(user=user, start_date=start_date, end_date=end_date)
    date = start_date
    while date <= min(end_date, today):
        DailyLearningProgress.objects.get_or_create(user=user, date=date)
        date += timedelta(days=1)
    return progress_payload(user, source_language=source_language, target_language=target_language)


def resume_streak(user, *, source_language: str = "spanish", target_language: str = "german") -> dict:
    today = timezone.localdate()
    active_pause = LearningStreakPause.objects.filter(
        user=user,
        start_date__lte=today,
        end_date__gte=today,
    ).first()
    if active_pause is None:
        raise ValueError("There is no active streak pause to resume")
    if active_pause.start_date == today:
        active_pause.delete()
    else:
        active_pause.end_date = today - timedelta(days=1)
        active_pause.save(update_fields=["end_date"])
    return progress_payload(user, source_language=source_language, target_language=target_language)


def progress_payload(user, *, source_language: str = "spanish", target_language: str = "german") -> dict:
    today = timezone.localdate()
    profile = _reconcile_profile(user, today)
    today_progress = _today_progress(user)
    language_key = _language_key(source_language, target_language)
    due_remaining = _due_review_count(user, source_language=source_language, target_language=target_language)
    active_seconds = int(today_progress.active_seconds_by_language.get(language_key, 0))
    completed_items = _completed_entry_count(today_progress, language_key)
    qualifies_by_time = active_seconds >= ACTIVE_STUDY_SECONDS_REQUIRED
    qualifies_by_pool = completed_items >= DAILY_POOL_ITEMS_REQUIRED and due_remaining == 0
    qualified_today = qualifies_by_time or qualifies_by_pool
    active_pause = LearningStreakPause.objects.filter(user=user, start_date__lte=today, end_date__gte=today).first()
    recent_progress = {
        entry.date: entry
        for entry in DailyLearningProgress.objects.filter(
            user=user,
            date__gte=today - timedelta(days=29),
            date__lte=today,
        )
    }
    history = []
    for offset in range(29, -1, -1):
        date = today - timedelta(days=offset)
        entry = recent_progress.get(date)
        history.append({
            "date": date.isoformat(),
            "status": entry.status if entry else DailyLearningProgress.Status.MISSED,
        })
    latest_pause = LearningStreakPause.objects.filter(user=user).order_by("-end_date").first()
    next_pause_available_on = (
        latest_pause.end_date + timedelta(days=PAUSE_COOLDOWN_DAYS)
        if latest_pause is not None
        else None
    )
    return {
        "current_streak": profile.current_streak,
        "longest_streak": profile.longest_streak,
        "flex_days": profile.flex_days,
        "qualifying_days_toward_flex": profile.qualifying_days_toward_flex,
        "active_seconds_today": active_seconds,
        "completed_items_today": completed_items,
        "due_reviews_remaining": due_remaining,
        "qualified_today": qualified_today,
        "qualification": "time" if qualifies_by_time else "pool" if qualifies_by_pool else "",
        "pause_active": active_pause is not None,
        "pause_end_date": active_pause.end_date.isoformat() if active_pause else None,
        "pause_available": next_pause_available_on is None or next_pause_available_on <= today,
        "next_pause_available_on": next_pause_available_on.isoformat() if next_pause_available_on else None,
        "history": history,
    }


def _today_progress(user) -> DailyLearningProgress:
    today = timezone.localdate()
    progress, _ = DailyLearningProgress.objects.get_or_create(user=user, date=today)
    return progress


@transaction.atomic
def _reconcile_profile(user, today):
    earliest_progress = DailyLearningProgress.objects.filter(user=user).order_by("date").values_list("date", flat=True).first()
    profile, _ = LearningStreakProfile.objects.get_or_create(
        user=user,
        defaults={"tracking_started_on": earliest_progress or today},
    )
    progresses = {
        entry.date: entry
        for entry in DailyLearningProgress.objects.select_for_update().filter(
            user=user,
            date__gte=profile.tracking_started_on,
            date__lte=today,
        )
    }
    pauses = list(LearningStreakPause.objects.filter(user=user, end_date__gte=profile.tracking_started_on, start_date__lte=today))
    current_streak = 0
    longest_streak = 0
    flex_days = 0
    qualifying_days_toward_flex = 0
    date = profile.tracking_started_on
    while date <= today:
        progress = progresses.get(date)
        is_qualified = progress is not None and _progress_qualifies(user, progress)
        is_paused = any(pause.start_date <= date <= pause.end_date for pause in pauses)
        if is_qualified:
            status = DailyLearningProgress.Status.STUDIED
            current_streak += 1
            qualifying_days_toward_flex += 1
            if qualifying_days_toward_flex >= QUALIFYING_DAYS_PER_FLEX_DAY and flex_days < FLEX_DAYS_MAXIMUM:
                flex_days += 1
                qualifying_days_toward_flex = 0
        elif is_paused:
            status = DailyLearningProgress.Status.PAUSED
        elif date < today and flex_days > 0:
            status = DailyLearningProgress.Status.FLEX
            current_streak += 1
            flex_days -= 1
        elif date < today:
            status = DailyLearningProgress.Status.MISSED
            current_streak = 0
            qualifying_days_toward_flex = 0
        else:
            status = DailyLearningProgress.Status.PENDING
        if progress is None and status in {
            DailyLearningProgress.Status.FLEX,
            DailyLearningProgress.Status.PAUSED,
        }:
            progress = DailyLearningProgress.objects.create(user=user, date=date, status=status)
        longest_streak = max(longest_streak, current_streak)
        if progress is not None and progress.status != status:
            progress.status = status
            progress.save(update_fields=["status", "updated_at"])
        date += timedelta(days=1)
    profile.current_streak = current_streak
    profile.longest_streak = max(profile.longest_streak, longest_streak)
    profile.flex_days = flex_days
    profile.qualifying_days_toward_flex = qualifying_days_toward_flex
    profile.save(update_fields=["current_streak", "longest_streak", "flex_days", "qualifying_days_toward_flex", "updated_at"])
    return profile


def _progress_qualifies(user, progress: DailyLearningProgress) -> bool:
    seconds_by_language = progress.active_seconds_by_language
    qualifies_by_time = (
        any(int(seconds) >= ACTIVE_STUDY_SECONDS_REQUIRED for seconds in seconds_by_language.values())
        if seconds_by_language
        else progress.active_seconds >= ACTIVE_STUDY_SECONDS_REQUIRED
    )
    return qualifies_by_time or progress.completed_daily_pool


def _language_key(source_language: str, target_language: str) -> str:
    return f"{source_language}:{target_language}"


def _completed_entry_count(progress: DailyLearningProgress, language_key: str) -> int:
    return sum(
        1
        for entry_key in progress.completed_entry_keys
        if str(entry_key).startswith(f"{language_key}:")
    )


def _due_review_count(user, *, source_language: str, target_language: str) -> int:
    _, tomorrow = local_day_bounds(timezone.now())
    return (
        apply_user_scope(Item.objects, user).filter(
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__lt=tomorrow,
        ).count()
        + apply_user_scope(Item.objects, user).filter(
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_de_to_es__isnull=False,
            due_at_de_to_es__lt=tomorrow,
        ).count()
    )
