from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..models import Item
from ..serializers import SessionItemSerializer
from .session import SessionEntry, serialize_entries


_REPEAT_STEPS = {"word_intro", "word_cloze", "word_parts", "phrase_builder"}


def _is_true(value: object) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes"}


class SessionItemPayloadView(APIView):
    def get(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language = str(request.query_params.get("source_language", "spanish")).strip().lower() or "spanish"
        target_language = str(request.query_params.get("target_language", "german")).strip().lower() or "german"
        mode = str(request.query_params.get("mode", "")).strip().lower()
        direction = str(request.query_params.get("direction", "")).strip() or None
        repeat_step = str(request.query_params.get("repeat_practice_step", "")).strip() or None

        if mode not in {"new", "review"}:
            return Response({"detail": "Invalid session mode"}, status=status.HTTP_400_BAD_REQUEST)
        if direction not in {None, *Item.ReviewDirection.values}:
            return Response({"detail": "Invalid review direction"}, status=status.HTTP_400_BAD_REQUEST)
        if mode == "review" and direction is None:
            return Response({"detail": "A review direction is required"}, status=status.HTTP_400_BAD_REQUEST)
        if mode == "new":
            direction = None
        if repeat_step not in {None, *_REPEAT_STEPS}:
            return Response({"detail": "Invalid practice step"}, status=status.HTTP_400_BAD_REQUEST)

        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if item is None:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        entry = SessionEntry(
            item=item,
            mode=mode,
            direction=direction,
            repeated_after_failure=_is_true(request.query_params.get("repeated_after_failure")),
            repeat_practice_step=repeat_step,
        )
        payload = serialize_entries([entry], user=user)
        return Response(SessionItemSerializer(payload[0]).data)
