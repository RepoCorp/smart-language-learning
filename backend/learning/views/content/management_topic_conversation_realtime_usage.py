from __future__ import annotations

from ...ai_usage import record_realtime_active_seconds, realtime_seconds_remaining
from ...auth import get_request_user
from .management import APIView, Request, Response, status


class ContentTopicConversationRealtimeUsageView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        if user is None:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            active_seconds = max(0, int(request.data.get("active_seconds", 0)))
        except (TypeError, ValueError):
            return Response({"detail": "active_seconds must be a non-negative number"}, status=status.HTTP_400_BAD_REQUEST)

        recorded_seconds = record_realtime_active_seconds(user=user, active_seconds=active_seconds)
        return Response(
            {
                "recorded_seconds": recorded_seconds,
                "remaining_seconds": realtime_seconds_remaining(user),
            }
        )
