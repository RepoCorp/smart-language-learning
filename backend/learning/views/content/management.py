from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...models import Item, SavedTopic
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
