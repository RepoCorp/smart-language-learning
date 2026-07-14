from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import RegistrationRequest, UserAuthToken


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


class AuthAdminCreateUserView(APIView):
    def post(self, request: Request) -> Response:
        request_user = get_request_user(request)
        if request_user is None or not request_user.is_superuser:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        username = str(request.data.get("username", "")).strip()
        email = str(request.data.get("email", "")).strip().lower()
        pin = str(request.data.get("pin", "")).strip()
        if not username or not email or not pin:
            return Response({"detail": "username, email and pin are required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(pin) < 4:
            return Response({"detail": "pin must have at least 4 characters"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=pin)
        RegistrationRequest.objects.filter(username__iexact=username).delete()
        RegistrationRequest.objects.filter(email__iexact=email).delete()
        return Response(
            {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_superuser": bool(user.is_superuser),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class AuthResetPinView(APIView):
    def post(self, request: Request) -> Response:
        request_user = get_request_user(request)
        if request_user is None or not request_user.is_superuser:
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
        return Response(
            {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_superuser": bool(user.is_superuser),
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
                    "is_superuser": bool(user.is_superuser),
                },
            }
        )


class AuthBootstrapStatusView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"can_public_register": True})


class AuthUsersView(APIView):
    def get(self, request: Request) -> Response:
        request_user = get_request_user(request)
        if request_user is None or not request_user.is_superuser:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        User = get_user_model()
        users = User.objects.order_by("username", "id").values("id", "username", "email", "is_superuser")
        return Response({"users": list(users)})
