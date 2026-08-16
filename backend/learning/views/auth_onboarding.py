from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import UserOnboarding


def should_show_getting_started(user) -> bool:
    onboarding, _ = UserOnboarding.objects.get_or_create(user=user)
    return onboarding.getting_started_seen_at is None


class AuthGettingStartedCompleteView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        onboarding, _ = UserOnboarding.objects.get_or_create(user=user)
        if onboarding.getting_started_seen_at is None:
            onboarding.getting_started_seen_at = timezone.now()
            onboarding.save(update_fields=["getting_started_seen_at"])
        return Response({"ok": True})
