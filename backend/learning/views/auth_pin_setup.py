from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import PinSetupToken, UserAuthToken
from .auth_onboarding import should_show_getting_started

PIN_SETUP_TOKEN_LIFETIME = timedelta(days=7)


class PinSetupTokenError(ValueError):
    pass


def create_pin_setup_token(*, user) -> str:
    raw_token = secrets.token_urlsafe(32)
    token_hash = _token_hash(raw_token)
    now = timezone.now()
    PinSetupToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
    PinSetupToken.objects.create(
        user=user,
        token_hash=token_hash,
        expires_at=now + PIN_SETUP_TOKEN_LIFETIME,
    )
    return raw_token


def consume_pin_setup_token(*, raw_token: str, pin: str):
    with transaction.atomic():
        token = (
            PinSetupToken.objects.select_for_update()
            .select_related("user")
            .filter(token_hash=_token_hash(raw_token), used_at__isnull=True)
            .first()
        )
        if token is None or token.expires_at <= timezone.now():
            raise PinSetupTokenError("This PIN setup link is invalid or has expired")

        user = token.user
        user.set_password(pin)
        user.save(update_fields=["password"])
        token.used_at = timezone.now()
        token.save(update_fields=["used_at"])
        return user


def _token_hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class AuthPinSetupView(APIView):
    def post(self, request: Request) -> Response:
        raw_token = str(request.data.get("token", "")).strip()
        pin = str(request.data.get("pin", "")).strip()
        if not raw_token or not pin:
            return Response({"detail": "token and pin are required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(pin) < 4:
            return Response({"detail": "pin must have at least 4 characters"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = consume_pin_setup_token(raw_token=raw_token, pin=pin)
        except PinSetupTokenError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        auth_token = UserAuthToken.objects.create(user=user)
        return Response(
            {
                "token": auth_token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_superuser": bool(user.is_superuser),
                },
                "show_getting_started": should_show_getting_started(user),
            }
        )
