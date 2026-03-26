from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import UserAuthToken


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
                },
            }
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
                },
            }
        )
