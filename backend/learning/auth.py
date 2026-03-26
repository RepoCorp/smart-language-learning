from __future__ import annotations

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework.request import Request

from .models import UserAuthToken


def _extract_bearer_token(request: Request) -> str:
    header = str(request.headers.get("Authorization", "")).strip()
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    fallback = str(request.headers.get("X-Auth-Token", "")).strip()
    return fallback


def get_request_user(request: Request):
    cached = getattr(request, "_learning_auth_user", None)
    if cached is not None:
        return cached

    token_key = _extract_bearer_token(request)
    if not token_key:
        setattr(request, "_learning_auth_user", None)
        return None

    token = (
        UserAuthToken.objects.select_related("user")
        .filter(key=token_key)
        .first()
    )
    if token is None:
        setattr(request, "_learning_auth_user", None)
        return None

    token.last_used_at = timezone.now()
    token.save(update_fields=["last_used_at"])
    setattr(request, "_learning_auth_user", token.user)
    return token.user


def apply_user_scope(queryset, user, *, field: str = "user"):
    if user is None:
        return queryset.filter(**{f"{field}__isnull": True})
    return queryset.filter(**{field: user})


def get_request_user_or_anonymous(request: Request):
    user = get_request_user(request)
    return user if user is not None else AnonymousUser()
