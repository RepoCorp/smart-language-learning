from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import APIException

from .ai_usage_context import current_ai_usage_feature, current_ai_usage_user
from .models import DailyAIUsage, UserAIUsageLimit


class AIUsageLimitExceeded(APIException):
    status_code = 429
    default_code = "ai_usage_limit_reached"
    default_detail = "Your daily AI usage limit has been reached. Please try again tomorrow."


@dataclass(frozen=True)
class AIUsageReservation:
    daily_usage_id: int


UNLIMITED_REALTIME_SECONDS = 2_147_483_647


def _is_quota_exempt(user) -> bool:
    """Superusers can develop and test without consuming user-facing allowances."""
    return bool(getattr(user, "is_superuser", False))


def _user_limit(user) -> UserAIUsageLimit:
    limit, _ = UserAIUsageLimit.objects.get_or_create(user=user)
    return limit


def _generation_credits(*, category: str, units: int, feature: str) -> int:
    if feature == "realtime-session":
        return 0
    if category == DailyAIUsage.Category.IMAGE:
        return 10
    if category == DailyAIUsage.Category.AUDIO:
        return max(1, (units + 249) // 250)
    return 1


def _week_start():
    today = timezone.localdate()
    return today, today - timedelta(days=today.weekday())


def realtime_seconds_remaining(user) -> int:
    if user is None or not getattr(user, "is_authenticated", True):
        return 0
    if _is_quota_exempt(user):
        return UNLIMITED_REALTIME_SECONDS
    today, week_start = _week_start()
    limit = _user_limit(user)
    minute_limit = limit.weekly_realtime_minutes or int(
        getattr(settings, "AI_USAGE_WEEKLY_REALTIME_MINUTES", 45)
    )
    used_seconds = (
        DailyAIUsage.objects.filter(
            user=user,
            date__gte=week_start,
            date__lte=today,
            feature="realtime-session",
        ).aggregate(total=Sum("usage_units"))["total"]
        or 0
    )
    return max(0, (minute_limit * 60) - int(used_seconds))


def record_realtime_active_seconds(*, user, active_seconds: int) -> int:
    if user is None or not getattr(user, "is_authenticated", True):
        return 0
    with transaction.atomic():
        requested_seconds = max(0, active_seconds)
        remaining_seconds = realtime_seconds_remaining(user)
        recorded_seconds = requested_seconds if _is_quota_exempt(user) else min(requested_seconds, remaining_seconds)
        if recorded_seconds == 0:
            return 0
        today = timezone.localdate()
        usage, _ = DailyAIUsage.objects.select_for_update().get_or_create(
            user=user,
            date=today,
            provider="openai",
            feature="realtime-session",
            model=str(getattr(settings, "OPENAI_REALTIME_MODEL", "gpt-realtime-2.1"))[:120],
            category=DailyAIUsage.Category.TEXT,
        )
        usage.usage_units += recorded_seconds
        usage.save(update_fields=("usage_units", "updated_at"))
        return recorded_seconds


def reserve_ai_usage(
    *,
    provider: str,
    category: str,
    units: int,
    model: str = "",
    feature: str = "",
) -> AIUsageReservation | None:
    """Reserve a user's weekly allowance before issuing an external AI request."""
    user = current_ai_usage_user()
    if user is None or not getattr(user, "is_authenticated", True):
        return None

    normalized_units = max(1, int(units))
    feature_name = (feature or current_ai_usage_feature("general")).strip()[:80]
    model_name = str(model or "").strip()[:120]
    credits = _generation_credits(category=category, units=normalized_units, feature=feature_name)
    today, week_start = _week_start()
    with transaction.atomic():
        limit = _user_limit(user)
        if limit.is_blocked:
            raise AIUsageLimitExceeded("AI generation is disabled for this account.")
        if feature_name == "realtime-session" and not _is_quota_exempt(user):
            realtime_used_seconds = (
                DailyAIUsage.objects.select_for_update()
                .filter(user=user, date__gte=week_start, date__lte=today, feature="realtime-session")
                .aggregate(total=Sum("usage_units"))["total"]
                or 0
            )
            realtime_limit_seconds = (limit.weekly_realtime_minutes or int(
                getattr(settings, "AI_USAGE_WEEKLY_REALTIME_MINUTES", 45)
            )) * 60
            if realtime_used_seconds >= realtime_limit_seconds:
                raise AIUsageLimitExceeded("Your weekly live conversation minute limit has been reached. Please try again next week.")
        if provider == "elevenlabs" and feature_name == "sing-strategy" and not _is_quota_exempt(user):
            used_seconds = (
                DailyAIUsage.objects.select_for_update()
                .filter(
                    user=user,
                    date__gte=week_start,
                    date__lte=today,
                    provider="elevenlabs",
                    feature="sing-strategy",
                )
                .aggregate(total=Sum("usage_units"))["total"]
                or 0
            )
            music_limit = limit.weekly_elevenlabs_music_seconds or int(
                getattr(settings, "AI_USAGE_WEEKLY_ELEVENLABS_MUSIC_SECONDS", 60)
            )
            if music_limit > 0 and used_seconds + normalized_units > music_limit:
                raise AIUsageLimitExceeded("Your weekly Eleven Music limit has been reached. Please try again next week.")
        elif provider == "elevenlabs" and category == DailyAIUsage.Category.AUDIO and not _is_quota_exempt(user):
            used_characters = (
                DailyAIUsage.objects.select_for_update()
                .filter(
                    user=user,
                    date__gte=week_start,
                    date__lte=today,
                    provider="elevenlabs",
                    category=DailyAIUsage.Category.AUDIO,
                ).exclude(
                    feature="sing-strategy",
                )
                .aggregate(total=Sum("usage_units"))["total"]
                or 0
            )
            character_limit = limit.weekly_elevenlabs_characters or int(
                getattr(settings, "AI_USAGE_WEEKLY_ELEVENLABS_CHARACTERS", 10000)
            )
            if character_limit > 0 and used_characters + normalized_units > character_limit:
                raise AIUsageLimitExceeded("Your weekly ElevenLabs character limit has been reached. Please try again next week.")
        elif not _is_quota_exempt(user):
            used_credits = (
                DailyAIUsage.objects.select_for_update()
                .filter(user=user, date__gte=week_start, date__lte=today)
                .exclude(provider="elevenlabs")
                .aggregate(total=Sum("quota_credits"))["total"]
                or 0
            )
            credit_limit = limit.weekly_generation_credits or int(
                getattr(settings, "AI_USAGE_WEEKLY_GENERATION_CREDITS", 200)
            )
            if credit_limit > 0 and used_credits + credits > credit_limit:
                raise AIUsageLimitExceeded("Your weekly AI usage limit has been reached. Please try again next week.")
        usage, _ = DailyAIUsage.objects.select_for_update().get_or_create(
            user=user,
            date=today,
            provider=provider[:20],
            feature=feature_name,
            model=model_name,
            category=category,
        )
        usage.request_count += 1
        if feature_name != "realtime-session":
            usage.usage_units += normalized_units
        if provider != "elevenlabs":
            usage.quota_credits += credits
        usage.save(update_fields=("request_count", "usage_units", "quota_credits", "updated_at"))
        return AIUsageReservation(daily_usage_id=usage.id)


def settle_ai_usage(
    reservation: AIUsageReservation | None,
    *,
    input_tokens: int = 0,
    output_tokens: int = 0,
    failed: bool = False,
) -> None:
    if reservation is None:
        return
    DailyAIUsage.objects.filter(id=reservation.daily_usage_id).update(
        input_tokens=F("input_tokens") + max(0, int(input_tokens)),
        output_tokens=F("output_tokens") + max(0, int(output_tokens)),
        failed_request_count=F("failed_request_count") + (1 if failed else 0),
    )
