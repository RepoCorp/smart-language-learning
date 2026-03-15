from __future__ import annotations

from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...models import Item, ItemDialogOccurrence, SavedTopic
from ...serializers import ContentTopicSerializer


def _normalized_pair(request: Request) -> tuple[str, str]:
    source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
    target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
    return source_language, target_language


class ContentItemsView(APIView):
    def get(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        items = list(
            Item.objects.filter(source_language=source_language, target_language=target_language)
            .order_by("-created_at", "-id")
            .values("id", "item_type", "spanish_text", "german_text", "created_at")[:200]
        )
        return Response({"items": items})


class ContentWordsView(APIView):
    def get(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        query = (request.query_params.get("q", "") or "").strip()

        words_queryset = Item.objects.filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        )
        if query:
            words_queryset = words_queryset.filter(
                Q(spanish_text__icontains=query) | Q(german_text__icontains=query)
            )

        words = list(
            words_queryset.order_by("-created_at", "-id").values(
                "id",
                "spanish_text",
                "german_text",
                "example_sentence",
                "notes",
                "audio_url",
                "created_at",
            )[:1000]
        )
        item_ids = [word["id"] for word in words]
        related_dialogs_map = _related_dialogs_by_item_ids(item_ids)
        for word in words:
            word["related_dialogs"] = related_dialogs_map.get(word["id"], [])
        return Response({"words": words})


class ContentItemDetailView(APIView):
    def delete(self, request: Request, item_id: int) -> Response:
        source_language, target_language = _normalized_pair(request)
        deleted, _ = Item.objects.filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).delete()
        if deleted == 0:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentTopicDeleteView(APIView):
    def delete(self, request: Request) -> Response:
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.validated_data["topic"].strip()
        source_language = serializer.validated_data.get("source_language", "spanish")
        target_language = serializer.validated_data.get("target_language", "german")

        deleted, _ = SavedTopic.objects.filter(
            topic=topic,
            source_language=source_language,
            target_language=target_language,
        ).delete()
        if deleted == 0:
            return Response({"detail": "Topic not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _related_dialogs_by_item_ids(item_ids: list[int], per_item_limit: int = 8) -> dict[int, list[dict]]:
    if not item_ids:
        return {}
    occurrences = (
        ItemDialogOccurrence.objects.filter(item_id__in=item_ids)
        .select_related("dialog", "turn")
        .order_by("-created_at", "-match_score", "-dialog__created_at", "-id")
    )
    by_item_dialog: dict[int, dict[int, dict]] = {}
    for occurrence in occurrences:
        dialogs_for_item = by_item_dialog.setdefault(occurrence.item_id, {})
        dialog_payload = dialogs_for_item.get(occurrence.dialog_id)
        if dialog_payload is None:
            if len(dialogs_for_item) >= per_item_limit:
                continue
            dialog_payload = {
                "dialog_id": occurrence.dialog_id,
                "topic": occurrence.dialog.topic,
                "context": occurrence.dialog.context,
                "audio_url": occurrence.dialog.audio_url,
                "created_at": occurrence.dialog.created_at.isoformat(),
                "turns": occurrence.dialog.turns if isinstance(occurrence.dialog.turns, list) else [],
                "matched_turns": [],
            }
            dialogs_for_item[occurrence.dialog_id] = dialog_payload
        matched_turn = {
            "turn_index": occurrence.turn_index,
            "side": occurrence.side,
            "match_score": occurrence.match_score,
            "source_text": occurrence.turn.source_text,
            "target_text": occurrence.turn.target_text,
        }
        if matched_turn not in dialog_payload["matched_turns"]:
            dialog_payload["matched_turns"].append(matched_turn)
    return {item_id: list(dialogs.values()) for item_id, dialogs in by_item_dialog.items()}
