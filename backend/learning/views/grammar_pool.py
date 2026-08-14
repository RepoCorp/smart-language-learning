from django.db.models.functions import Length
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope
from ..models import Item
from .admin_access import require_admin
from .content.management_items_phrase_grammar import analyze_phrase_grammar_features


class PhraseGrammarPoolView(APIView):
    def post(self, request: Request) -> Response:
        user = require_admin(request)
        if user is None:
            return Response({"detail": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        source_language = str(request.data.get("source_language", "spanish")).strip().lower() or "spanish"
        target_language = str(request.data.get("target_language", "german")).strip().lower() or "german"
        if target_language != "german":
            return Response({"detail": "Grammar metadata is currently available for German phrases only."}, status=status.HTTP_400_BAD_REQUEST)

        item = (
            apply_user_scope(Item.objects, user)
            .filter(
                item_type=Item.ItemType.PHRASE,
                source_language=source_language,
                target_language=target_language,
                phrase_grammar_checked_at__isnull=True,
            )
            .annotate(target_length=Length("german_text"))
            .order_by("target_length", "id")
            .first()
        )
        if item is None:
            return Response({"status": "empty"})

        feature_keys = analyze_phrase_grammar_features(item)
        if feature_keys is None:
            return Response({"detail": "Failed to analyze phrase grammar"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            "status": "processed",
            "item_id": item.id,
            "feature_keys": feature_keys,
        })
