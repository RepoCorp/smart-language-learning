from __future__ import annotations

from ...grammar_features import GERMAN_NOUN_GENDER_FEATURES
from ...models import Item
from .management import APIView, Request, Response, _normalized_pair, apply_user_scope, get_request_user, status


class ContentItemGrammarExamplesView(APIView):
    def get(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        if target_language != "german" or (item.word_type or "").strip().lower() != "noun":
            return Response({"examples": {}})

        examples: dict[str, dict[str, str]] = {}
        for gender, feature_key in GERMAN_NOUN_GENDER_FEATURES.items():
            candidate = apply_user_scope(Item.objects, user).filter(
                item_type=Item.ItemType.WORD,
                source_language=source_language,
                target_language=target_language,
                word_type="noun",
                grammar_features__feature_key=feature_key,
            ).exclude(id=item.id).order_by("-updated_at", "-id").first()
            if candidate:
                examples[gender] = {
                "target_text": candidate.german_text,
                "source_text": candidate.spanish_text,
                "plural_german": candidate.plural_german or "",
            }
        return Response({"examples": examples})
