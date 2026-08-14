from __future__ import annotations

from ...grammar_features import PHRASE_GRAMMAR_FEATURES
from ...models import Item, ItemGrammarFeature
from ...prompts import PHRASE_GRAMMAR_FEATURES_PROMPT
from .generation import WORD_EXERCISE_MODEL
from .management import (
    APIView,
    Request,
    Response,
    _call_openai_json_logged,
    _normalized_pair,
    _render_prompt,
    apply_user_scope,
    get_request_user,
    status,
)


def _grammar_feature_list() -> str:
    return "\n\n".join(
        f"{feature_key}:\n{description}"
        for feature_key, description in PHRASE_GRAMMAR_FEATURES.items()
    )


def _requested_feature_key(request: Request) -> str | None:
    feature_key = str(request.query_params.get("feature_key", "")).strip()
    return feature_key if feature_key in PHRASE_GRAMMAR_FEATURES else None


class ContentItemPhraseGrammarFeaturesView(APIView):
    def get(self, request: Request, item_id: int) -> Response:
        feature_key = _requested_feature_key(request)
        if not feature_key:
            return Response({"detail": "Unknown grammar feature"}, status=status.HTTP_400_BAD_REQUEST)
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.PHRASE,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Phrase not found"}, status=status.HTTP_404_NOT_FOUND)

        examples = (
            apply_user_scope(Item.objects, user)
            .filter(
                item_type=Item.ItemType.PHRASE,
                source_language=source_language,
                target_language=target_language,
                grammar_features__feature_key=feature_key,
            )
            .exclude(id=item.id)
            .order_by("?")[:5]
        )
        return Response(
            {
                "examples": [
                    {"target_text": example.german_text, "source_text": example.spanish_text}
                    for example in examples
                ]
            }
        )

    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.PHRASE,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Phrase not found"}, status=status.HTTP_404_NOT_FOUND)
        if target_language != "german":
            return Response({"feature_keys": []})

        parsed = _call_openai_json_logged(
            label="content_item_phrase_grammar_features",
            system_prompt=_render_prompt(
                PHRASE_GRAMMAR_FEATURES_PROMPT,
                sentence=item.german_text,
                grammar_features=_grammar_feature_list(),
            ),
            user_input=item.german_text,
            timeout_seconds=12,
            model=WORD_EXERCISE_MODEL,
            temperature=1.0,
            top_p=1.0,
            presence_penalty=0.0,
        )
        if not isinstance(parsed, list) or not all(isinstance(value, str) for value in parsed):
            return Response({"detail": "Failed to analyze phrase grammar"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        detected_features = set(parsed).intersection(PHRASE_GRAMMAR_FEATURES)
        for feature_key in detected_features:
            ItemGrammarFeature.objects.get_or_create(item=item, feature_key=feature_key)
        return Response(
            {
                "feature_keys": [
                    feature_key
                    for feature_key in PHRASE_GRAMMAR_FEATURES
                    if feature_key in detected_features
                ]
            }
        )
