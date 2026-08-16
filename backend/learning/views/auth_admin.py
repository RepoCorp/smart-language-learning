from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import RegistrationRequest
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
