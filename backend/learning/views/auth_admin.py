from __future__ import annotations

from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import Q, Sum
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import DailyAIUsage, RegistrationRequest, UserAIUsageLimit
from .auth_pin_setup import create_pin_setup_token


def _require_admin(request: Request):
    user = get_request_user(request)
    return user if user is not None and user.is_superuser else None


def _user_payload(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_superuser": bool(user.is_superuser),
    }


class AuthAdminCreateUserView(APIView):
    def post(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        username = str(request.data.get("username", "")).strip()
        email = str(request.data.get("email", "")).strip().lower()
        if not username or not email:
            return Response({"detail": "username and email are required"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email)
        pin_setup_token = create_pin_setup_token(user=user)
        RegistrationRequest.objects.filter(username__iexact=username).delete()
        RegistrationRequest.objects.filter(email__iexact=email).delete()
        return Response(
            {"user": _user_payload(user), "pin_setup_token": pin_setup_token},
            status=status.HTTP_201_CREATED,
        )


class AuthResetPinView(APIView):
    def post(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        identifier = str(request.data.get("identifier", "")).strip()
        pin = str(request.data.get("pin", "")).strip()
        if not identifier or not pin:
            return Response({"detail": "identifier and pin are required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(pin) < 4:
            return Response({"detail": "pin must have at least 4 characters"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        user = (
            User.objects.filter(username__iexact=identifier).first()
            or User.objects.filter(email__iexact=identifier).first()
        )
        if user is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(pin)
        user.save(update_fields=["password"])
        return Response({"user": _user_payload(user)})


class AuthUsersView(APIView):
    def get(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        User = get_user_model()
        users = User.objects.order_by("username", "id").values("id", "username", "email", "is_superuser")
        return Response({"users": list(users)})


class AuthDeleteUserView(APIView):
    def post(self, request: Request) -> Response:
        admin = _require_admin(request)
        if admin is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)
        try:
            user_id = int(request.data.get("user_id"))
        except (TypeError, ValueError):
            return Response({"detail": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if user_id == admin.id:
            return Response({"detail": "You cannot delete your own account"}, status=status.HTTP_400_BAD_REQUEST)
        user = get_user_model().objects.filter(id=user_id).first()
        if user is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        user.delete()
        return Response({"ok": True})


class AuthRegistrationRequestsView(APIView):
    def get(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        requests = RegistrationRequest.objects.order_by("-created_at", "-id").values(
            "id",
            "username",
            "email",
            "created_at",
        )
        return Response({"requests": list(requests)})


class AuthAIUsageView(APIView):
    def get(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        users = get_user_model().objects.order_by("username", "id")
        usage_by_user = {
            row["user_id"]: row
            for row in DailyAIUsage.objects.filter(date__gte=week_start, date__lte=today)
            .values("user_id")
            .annotate(
                generation_credits=Sum("quota_credits", filter=~Q(provider="elevenlabs")),
                elevenlabs_characters=Sum(
                    "usage_units",
                    filter=Q(provider="elevenlabs", category=DailyAIUsage.Category.AUDIO),
                ),
                realtime_seconds=Sum("usage_units", filter=Q(feature="realtime-session")),
            )
        }
        limits = {limit.user_id: limit for limit in UserAIUsageLimit.objects.filter(user__in=users)}
        return Response({
            "week_start": week_start.isoformat(),
            "defaults": {
                "weekly_generation_credits": int(getattr(settings, "AI_USAGE_WEEKLY_GENERATION_CREDITS", 200)),
                "weekly_elevenlabs_characters": int(getattr(settings, "AI_USAGE_WEEKLY_ELEVENLABS_CHARACTERS", 10000)),
                "weekly_realtime_minutes": int(getattr(settings, "AI_USAGE_WEEKLY_REALTIME_MINUTES", 45)),
            },
            "users": [
                {
                    **_user_payload(user),
                    "is_blocked": bool(limits.get(user.id) and limits[user.id].is_blocked),
                    "weekly_generation_credits": limits.get(user.id).weekly_generation_credits if user.id in limits else 0,
                    "weekly_elevenlabs_characters": limits.get(user.id).weekly_elevenlabs_characters if user.id in limits else 0,
                    "weekly_realtime_minutes": limits.get(user.id).weekly_realtime_minutes if user.id in limits else 0,
                    "week_generation_credits": usage_by_user.get(user.id, {}).get("generation_credits") or 0,
                    "week_elevenlabs_characters": usage_by_user.get(user.id, {}).get("elevenlabs_characters") or 0,
                    "week_realtime_minutes": (
                        ((usage_by_user.get(user.id, {}).get("realtime_seconds") or 0) + 59) // 60
                    ),
                }
                for user in users
            ],
        })


class AuthAIUsageLimitView(APIView):
    def post(self, request: Request) -> Response:
        if _require_admin(request) is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)
        try:
            user_id = int(request.data.get("user_id"))
        except (TypeError, ValueError):
            return Response({"detail": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        user = get_user_model().objects.filter(id=user_id).first()
        if user is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        limit, _ = UserAIUsageLimit.objects.get_or_create(user=user)
        limit.is_blocked = bool(request.data.get("is_blocked", False))
        for field in ("weekly_generation_credits", "weekly_elevenlabs_characters", "weekly_realtime_minutes"):
            try:
                value = max(0, int(request.data.get(field, 0)))
            except (TypeError, ValueError):
                return Response({"detail": f"{field} must be a non-negative number"}, status=status.HTTP_400_BAD_REQUEST)
            setattr(limit, field, value)
        limit.save()
        return Response({"ok": True})
