from __future__ import annotations

from django.utils import timezone

from .auth import get_request_user
from .user_timezones import effective_user_timezone_name


class UserTimezoneMiddleware:
    """Applies the learner's timezone before request-scoped learning logic runs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = get_request_user(request)
        with timezone.override(effective_user_timezone_name(user)):
            return self.get_response(request)
