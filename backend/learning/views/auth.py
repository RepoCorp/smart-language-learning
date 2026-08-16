from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import RegistrationRequest, UserAuthToken
from .auth_onboarding import should_show_getting_started


class AuthLoginView(APIView):
    def post(self, request: Request) -> Response:
        identifier = str(request.data.get("identifier", "")).strip()
        pin = str(request.data.get("pin", "")).strip()
        if not identifier or not pin:
            return Response({"detail": "identifier and pin are required"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        matched_user = (
            User.objects.filter(username__iexact=identifier).first()
            or User.objects.filter(email__iexact=identifier).first()
        )
        if matched_user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        user = authenticate(request=request, username=matched_user.username, password=pin)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        token = UserAuthToken.objects.create(user=user)
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_superuser": bool(user.is_superuser),
                },
                "show_getting_started": should_show_getting_started(user),
            }
        )


class AuthRegisterView(APIView):
    def post(self, request: Request) -> Response:
        username = str(request.data.get("username", "")).strip()
        email = str(request.data.get("email", "")).strip().lower()
        if not username or not email:
            return Response({"detail": "username and email are required"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()

        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if RegistrationRequest.objects.filter(username__iexact=username).exists():
            return Response({"detail": "A request with this username already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if RegistrationRequest.objects.filter(email__iexact=email).exists():
            return Response({"detail": "A request with this email already exists"}, status=status.HTTP_400_BAD_REQUEST)

        RegistrationRequest.objects.create(
            username=username,
            email=email,
        )
        return Response(
            {
                "ok": True,
                "message": "Registration request submitted",
            },
            status=status.HTTP_201_CREATED,
        )


class AuthLogoutView(APIView):
    def post(self, request: Request) -> Response:
        token_key = str(request.headers.get("Authorization", "")).strip()
        if token_key.lower().startswith("bearer "):
            token_key = token_key[7:].strip()
        if not token_key:
            token_key = str(request.headers.get("X-Auth-Token", "")).strip()
        if token_key:
            UserAuthToken.objects.filter(key=token_key).delete()
        return Response({"ok": True})


class AuthMeView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        if user is None:
            return Response({"authenticated": False, "user": None})
        return Response(
            {
                "authenticated": True,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_superuser": bool(user.is_superuser),
                },
            }
        )


class AuthBootstrapStatusView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"can_public_register": True})
