from __future__ import annotations

from datetime import date

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..streaks import create_pause, progress_payload, record_study_time, resume_streak


def _require_user(request: Request):
    user = get_request_user(request)
    if user is None:
        return None
    return user


def _language_pair(request: Request) -> tuple[str, str]:
    source_language = str(request.query_params.get("source_language", "spanish")).strip().lower()
    target_language = str(request.query_params.get("target_language", "german")).strip().lower()
    return source_language, target_language


def _history_month(request: Request) -> date | None:
    raw_month = str(request.query_params.get("history_month", "")).strip()
    if not raw_month:
        return None
    try:
        return date.fromisoformat(f"{raw_month}-01")
    except ValueError as exc:
        raise ValueError("history_month must use YYYY-MM") from exc


class LearningProgressView(APIView):
    def get(self, request: Request) -> Response:
        user = _require_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        source_language, target_language = _language_pair(request)
        try:
            history_month = _history_month(request)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if history_month and history_month > timezone.localdate().replace(day=1):
            return Response({"detail": "history_month cannot be in the future"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(progress_payload(
            user,
            source_language=source_language,
            target_language=target_language,
            history_month=history_month,
        ))


class LearningProgressStudyTimeView(APIView):
    def post(self, request: Request) -> Response:
        user = _require_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            seconds = int(request.data.get("seconds", 0))
        except (TypeError, ValueError):
            return Response({"detail": "seconds must be a number"}, status=status.HTTP_400_BAD_REQUEST)
        if seconds <= 0:
            return Response({"detail": "seconds must be positive"}, status=status.HTTP_400_BAD_REQUEST)
        source_language, target_language = _language_pair(request)
        return Response(record_study_time(user, seconds, source_language=source_language, target_language=target_language))


class LearningProgressPauseView(APIView):
    def post(self, request: Request) -> Response:
        user = _require_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            start_date = date.fromisoformat(str(request.data.get("start_date", "")))
            end_date = date.fromisoformat(str(request.data.get("end_date", "")))
        except ValueError:
            return Response({"detail": "Dates must use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            source_language, target_language = _language_pair(request)
            return Response(create_pause(user, start_date=start_date, end_date=end_date, source_language=source_language, target_language=target_language))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class LearningProgressResumeView(APIView):
    def post(self, request: Request) -> Response:
        user = _require_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            source_language, target_language = _language_pair(request)
            return Response(resume_streak(user, source_language=source_language, target_language=target_language))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
