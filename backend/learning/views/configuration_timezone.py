from __future__ import annotations

from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import UserTimezonePreference
from ..user_timezones import normalized_timezone_name


class UserTimezonePreferenceView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        preference = UserTimezonePreference.objects.filter(user=user).only("timezone").first()
        configured_timezone = preference.timezone if preference is not None else ""
        return Response(
            {
                "timezone": configured_timezone,
                "effective_timezone": normalized_timezone_name(configured_timezone) or settings.TIME_ZONE,
            }
        )

    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        timezone_name = normalized_timezone_name(str(request.data.get("timezone", "")))
        if not timezone_name:
            return Response({"detail": "Enter a valid IANA timezone, such as Europe/Amsterdam."}, status=status.HTTP_400_BAD_REQUEST)

        UserTimezonePreference.objects.update_or_create(user=user, defaults={"timezone": timezone_name})
        return Response({"timezone": timezone_name, "effective_timezone": timezone_name})
