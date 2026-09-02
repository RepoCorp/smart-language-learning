from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings

from .models import UserTimezonePreference


def normalized_timezone_name(value: str) -> str:
    timezone_name = str(value or "").strip()
    if not timezone_name:
        return ""
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return ""
    return timezone_name


def effective_user_timezone_name(user) -> str:
    if user is None or not getattr(user, "is_authenticated", True):
        return settings.TIME_ZONE

    preference = UserTimezonePreference.objects.filter(user=user).only("timezone").first()
    return normalized_timezone_name(preference.timezone if preference is not None else "") or settings.TIME_ZONE
