from __future__ import annotations

from .ai_usage_context import ai_usage_request_context
from .auth import get_request_user


class AIUsageRequestContextMiddleware:
    """Makes the authenticated user available to shared provider clients."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = get_request_user(request)
        with ai_usage_request_context(user):
            return self.get_response(request)
