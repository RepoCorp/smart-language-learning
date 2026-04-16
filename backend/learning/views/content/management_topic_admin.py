from __future__ import annotations

from .management import (
    APIView,
    ContentTopicSerializer,
    Request,
    Response,
    SavedTopic,
    apply_user_scope,
    get_request_user,
    status,
)

class ContentTopicDeleteView(APIView):
    def delete(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.validated_data["topic"].strip()
        source_language = serializer.validated_data.get("source_language", "spanish")
        target_language = serializer.validated_data.get("target_language", "german")

        deleted, _ = apply_user_scope(SavedTopic.objects, user).filter(
            topic=topic,
            source_language=source_language,
            target_language=target_language,
        ).delete()
        if deleted == 0:
            return Response({"detail": "Topic not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
